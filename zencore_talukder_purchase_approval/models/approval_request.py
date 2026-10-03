from collections import defaultdict

from odoo import _, models
from odoo.exceptions import UserError


class ApprovalRequest(models.Model):
    _inherit = "approval.request"

    # =========================================================
    # Vendor
    # =========================================================

    def _zencore_get_line_vendor(self, line):
        """
        Return ONE vendor for an approval product line.

        Priority:
        1. Vendor/SupplierInfo explicitly stored on approval line
        2. Vendor (res.partner) explicitly stored on approval line
        3. First applicable vendor configured on Product -> Purchase

        IMPORTANT:
        We intentionally DO NOT use product._select_seller().
        _select_seller() may choose another alternative vendor
        depending on quantity/date/min_qty.
        """

        self.ensure_one()

        Partner = self.env["res.partner"]

        # -----------------------------------------------------
        # 1. Check product.supplierinfo fields on approval line
        # -----------------------------------------------------
        supplierinfo_fields = [
            "seller_id",
            "seller_ids",
            "supplierinfo_id",
            "supplierinfo_ids",
            "vendor_info_id",
            "vendor_info_ids",
        ]

        for field_name in supplierinfo_fields:

            if field_name not in line._fields:
                continue

            field = line._fields[field_name]

            if (
                getattr(field, "comodel_name", None)
                != "product.supplierinfo"
            ):
                continue

            supplierinfos = line[field_name]

            if supplierinfos:
                supplier = supplierinfos[:1]

                if supplier.partner_id:
                    return supplier.partner_id

        # -----------------------------------------------------
        # 2. Check res.partner vendor fields on approval line
        # -----------------------------------------------------
        partner_fields = [
            "vendor_id",
            "vendor_ids",
            "supplier_id",
            "supplier_ids",
            "partner_id",
            "partner_ids",
        ]

        for field_name in partner_fields:

            if field_name not in line._fields:
                continue

            field = line._fields[field_name]

            if (
                getattr(field, "comodel_name", None)
                != "res.partner"
            ):
                continue

            partners = line[field_name]

            if partners:
                return partners[:1]

        # -----------------------------------------------------
        # Try any relational field whose label says
        # Vendor / Vendors / Supplier / Suppliers.
        # -----------------------------------------------------
        for field_name, field in line._fields.items():

            label = (field.string or "").strip().lower()

            if label not in (
                "vendor",
                "vendors",
                "supplier",
                "suppliers",
            ):
                continue

            comodel = getattr(
                field,
                "comodel_name",
                None,
            )

            value = line[field_name]

            if not value:
                continue

            if comodel == "res.partner":
                return value[:1]

            if comodel == "product.supplierinfo":
                supplier = value[:1]

                if supplier.partner_id:
                    return supplier.partner_id

        # -----------------------------------------------------
        # 3. Fallback:
        # Product -> Purchase -> Vendors
        #
        # IMPORTANT:
        # Choose only the FIRST configured/applicable vendor.
        # Do not create RFQs for every seller.
        # -----------------------------------------------------

        product = line.product_id

        if not product:
            return Partner

        seller_infos = product.product_tmpl_id.seller_ids.filtered(
            lambda seller:
                (
                    not seller.company_id
                    or seller.company_id == self.company_id
                )
                and (
                    not seller.product_id
                    or seller.product_id == product
                )
        )

        # Vendor order on Product Purchase tab is primarily
        # determined by sequence.
        seller_infos = seller_infos.sorted(
            key=lambda seller: (
                seller.sequence,
                seller.id,
            )
        )

        if not seller_infos:
            return Partner

        seller = seller_infos[0]

        return seller.partner_id

    # =========================================================
    # Quantity
    # =========================================================

    def _zencore_get_line_quantity(self, line):

        for field_name in (
            "quantity",
            "product_qty",
            "qty",
        ):

            if field_name in line._fields:
                return line[field_name] or 1.0

        return 1.0

    # =========================================================
    # UoM
    # =========================================================

    def _zencore_get_line_uom(self, line):

        if (
            "product_uom_id" in line._fields
            and line.product_uom_id
        ):
            return line.product_uom_id

        if (
            "product_uom" in line._fields
            and line.product_uom
        ):
            return line.product_uom

        if (
            "uom_id" in line._fields
            and line.uom_id
        ):
            return line.uom_id

        product = line.product_id

        return product.uom_po_id or product.uom_id

    # =========================================================
    # Purchase Order Line
    # =========================================================

    def _zencore_prepare_purchase_line(
        self,
        approval_line,
        purchase_order,
    ):

        product = approval_line.product_id

        quantity = self._zencore_get_line_quantity(
            approval_line
        )

        uom = self._zencore_get_line_uom(
            approval_line
        )

        vals = {
            "order_id": purchase_order.id,
            "product_id": product.id,
            "product_qty": quantity,
            "product_uom": uom.id,
        }

        if (
            "description" in approval_line._fields
            and approval_line.description
        ):
            vals["name"] = approval_line.description

        return vals

    # =========================================================
    # Create RFQ
    # =========================================================

    def action_create_purchase_orders(self):

        PurchaseOrder = self.env["purchase.order"]
        PurchaseOrderLine = self.env[
            "purchase.order.line"
        ]

        for request in self:

            # -------------------------------------------------
            # Must be approved
            # -------------------------------------------------

            if request.request_status != "approved":
                raise UserError(
                    _(
                        "The approval request must be "
                        "approved before creating an RFQ."
                    )
                )

            # -------------------------------------------------
            # Product lines
            # -------------------------------------------------

            product_lines = (
                request.product_line_ids.filtered(
                    lambda line: line.product_id
                )
            )

            if not product_lines:
                raise UserError(
                    _(
                        "Please add at least one product "
                        "before creating an RFQ."
                    )
                )

            # -------------------------------------------------
            # Don't create RFQ twice for same approval
            # -------------------------------------------------

            for line in product_lines:

                if (
                    "purchase_order_line_id"
                    in line._fields
                    and line.purchase_order_line_id
                ):
                    raise UserError(
                        _(
                            "RFQ has already been created "
                            "for this approval request."
                        )
                    )

            # -------------------------------------------------
            # Group ALL products by vendor
            #
            # Example:
            #
            # Product 123  -> A Aziz
            # Product 1234 -> A Aziz
            #
            # becomes:
            #
            # A Aziz -> [123, 1234]
            #
            # Therefore only ONE RFQ.
            # -------------------------------------------------

            lines_by_vendor = defaultdict(
                lambda: self.env[
                    product_lines._name
                ]
            )

            vendor_records = {}

            for line in product_lines:

                vendor = (
                    request._zencore_get_line_vendor(
                        line
                    )
                )

                if not vendor:
                    raise UserError(
                        _(
                            "No vendor is configured "
                            "for product '%s'."
                        )
                        % line.product_id.display_name
                    )

                vendor = vendor[:1]

                vendor_records[vendor.id] = vendor

                lines_by_vendor[vendor.id] |= line

            # -------------------------------------------------
            # NEW RFQ per vendor
            # -------------------------------------------------

            for vendor_id, vendor_lines in (
                lines_by_vendor.items()
            ):

                vendor = vendor_records[vendor_id]

                # =============================================
                # IMPORTANT
                #
                # No search() for old RFQ.
                #
                # Therefore another Approval Request always
                # gets a fresh RFQ.
                # =============================================

                purchase_order = PurchaseOrder.create({
                    "partner_id": vendor.id,
                    "origin": request.name,
                    "company_id": request.company_id.id,
                })

                # -------------------------------------------------
                # All products of this vendor go into this RFQ
                # -------------------------------------------------

                for approval_line in vendor_lines:

                    line_vals = (
                        request
                        ._zencore_prepare_purchase_line(
                            approval_line,
                            purchase_order,
                        )
                    )

                    purchase_line = (
                        PurchaseOrderLine.create(
                            line_vals
                        )
                    )

                    # =========================================
                    # Odoo default smart button relation
                    # =========================================

                    if (
                        "purchase_order_line_id"
                        not in approval_line._fields
                    ):
                        raise UserError(
                            _(
                                "Field "
                                "'purchase_order_line_id' "
                                "was not found."
                            )
                        )

                    approval_line.write({
                        "purchase_order_line_id":
                            purchase_line.id,
                    })

        # =====================================================
        # Stay on Approval form
        #
        # Do NOT open RFQ automatically.
        #
        # Reload current record so Purchase Orders smart
        # button/count immediately appears.
        # =====================================================

        return {
            "type": "ir.actions.client",
            "tag": "reload",
        }