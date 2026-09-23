from odoo import http, fields
from odoo.http import request
from werkzeug.exceptions import Forbidden
import json


class SaleOrder(http.Controller):

    # ============================================================
    # Sales Access Security
    # ============================================================
    def _check_sales_access(self):
        user = request.env.user

        has_sales_access = user.has_group(
            "crm_portal_user.group_sales_website_access"
        )

        is_system_user = user.has_group(
            "base.group_system"
        )

        if not (has_sales_access or is_system_user):
            raise Forbidden(
                "You do not have permission to access Sales."
            )

    # ============================================================
    # Sale Order Page
    # ============================================================
    @http.route(
        "/sale_order",
        type="http",
        auth="user",
        website=True,
    )
    def sale_order(self, **kwargs):

        # Server-side Sales permission check
        self._check_sales_access()

        company_id = request.env.company.id

        products = request.env["product.product"].sudo().search(
            [("sale_ok", "=", True)],
            order="name",
        )

        product_tax_map = {
            product.id: sum(
                tax.amount
                for tax in product.taxes_id
                if tax.amount_type == "percent"
            )
            for product in products
        }

        product_tax_ids_map = {
            product.id: ",".join(
                str(tax.id)
                for tax in product.taxes_id
            )
            for product in products
        }

        SaleOrderModel = request.env["sale.order"].sudo()

        # --------------------------------------------------------
        # Payment Methods
        # --------------------------------------------------------
        payment_method_field = SaleOrderModel._fields[
            "preferred_payment_method_line_id"
        ]

        PaymentMethodModel = request.env[
            payment_method_field.comodel_name
        ].sudo()

        payment_method_domain = []

        if "active" in PaymentMethodModel._fields:
            payment_method_domain.append(
                ("active", "=", True)
            )

        if "company_id" in PaymentMethodModel._fields:
            payment_method_domain += [
                "|",
                ("company_id", "=", False),
                ("company_id", "=", company_id),
            ]

        payment_methods = PaymentMethodModel.search(
            payment_method_domain,
            order="name",
        )

        unique_payment_methods = PaymentMethodModel.browse()
        seen_payment_method_names = set()

        for method in payment_methods:
            method_name = method.display_name

            if method_name in seen_payment_method_names:
                continue

            seen_payment_method_names.add(method_name)
            unique_payment_methods |= method

        payment_methods = unique_payment_methods

        # --------------------------------------------------------
        # Invoice Journals
        # --------------------------------------------------------
        invoice_journals = request.env[
            "account.journal"
        ].sudo().search(
            [
                ("type", "=", "sale"),
                ("company_id", "=", company_id),
            ],
            order="name",
        )

        # --------------------------------------------------------
        # Sale Tags
        # --------------------------------------------------------
        sale_tag_field = SaleOrderModel._fields.get(
            "tag_ids"
        )

        sale_tags = (
            request.env[
                sale_tag_field.comodel_name
            ].sudo().search(
                [],
                order="name",
            )
            if sale_tag_field
            else request.env["crm.tag"].sudo().browse()
        )

        # --------------------------------------------------------
        # Default Sale Order Values
        # --------------------------------------------------------
        sale_defaults = SaleOrderModel.default_get(
            [
                "user_id",
                "team_id",
                "company_id",
                "require_signature",
                "require_payment",
                "warehouse_id",
                "picking_policy",
            ]
        )

        default_salesperson = (
            request.env["res.users"]
            .sudo()
            .browse(sale_defaults.get("user_id"))
            .exists()
        )

        default_sales_team = (
            request.env["crm.team"]
            .sudo()
            .browse(sale_defaults.get("team_id"))
            .exists()
        )

        default_warehouse = (
            request.env["stock.warehouse"]
            .sudo()
            .browse(sale_defaults.get("warehouse_id"))
            .exists()
        )

        # --------------------------------------------------------
        # Template Values
        # --------------------------------------------------------
        values = {
            "active_menu": "sale_order",

            "products": products,

            "product_tax_map": product_tax_map,

            "product_tax_ids_map": product_tax_ids_map,

            "customers": request.env[
                "res.partner"
            ].sudo().search(
                [],
                order="name",
            ),

            "payment_methods": payment_methods,

            "invoice_journals": invoice_journals,

            "sale_tags": sale_tags,

            "default_salesperson": default_salesperson,

            "default_sales_team": default_sales_team,

            "default_warehouse": default_warehouse,

            "pricelists": request.env[
                "product.pricelist"
            ].sudo().search(
                [
                    "|",
                    ("company_id", "=", False),
                    ("company_id", "=", company_id),
                ],
                order="name",
            ),

            "payment_terms": request.env[
                "account.payment.term"
            ].sudo().search(
                [
                    "|",
                    ("company_id", "=", False),
                    ("company_id", "=", company_id),
                ],
                order="name",
            ),

            "taxes": request.env[
                "account.tax"
            ].sudo().search(
                [
                    ("type_tax_use", "in", ["sale", "none"]),
                    "|",
                    ("company_id", "=", False),
                    ("company_id", "=", company_id),
                ],
                order="name",
            ),

            "sale_defaults": sale_defaults,

            "salespersons": request.env[
                "res.users"
            ].sudo().search(
                [
                    ("share", "=", False),
                ],
                order="name",
            ),

            "sales_teams": request.env[
                "crm.team"
            ].sudo().search(
                [
                    "|",
                    ("company_id", "=", False),
                    ("company_id", "=", company_id),
                ],
                order="name",
            ),

            "companies": request.env[
                "res.company"
            ].sudo().search(
                [],
                order="name",
            ),

            "fiscal_positions": request.env[
                "account.fiscal.position"
            ].sudo().search(
                [
                    "|",
                    ("company_id", "=", False),
                    ("company_id", "=", company_id),
                ],
                order="name",
            ),

            "warehouses": request.env[
                "stock.warehouse"
            ].sudo().search(
                [
                    ("company_id", "=", company_id),
                ],
                order="name",
            ),

            "incoterms": request.env[
                "account.incoterms"
            ].sudo().search(
                [],
                order="name",
            ),

            "picking_policies": request.env[
                "sale.order"
            ]._fields["picking_policy"].selection,

            "opportunities": request.env[
                "crm.lead"
            ].sudo().search(
                [
                    ("type", "=", "opportunity"),
                ],
                order="name",
            ),

            "utm_campaigns": request.env[
                "utm.campaign"
            ].sudo().search(
                [],
                order="name",
            ),

            "utm_mediums": request.env[
                "utm.medium"
            ].sudo().search(
                [],
                order="name",
            ),

            "utm_sources": request.env[
                "utm.source"
            ].sudo().search(
                [],
                order="name",
            ),
        }

        return request.render(
            "crm_portal_user.sale_order_template",
            values,
        )

    # ============================================================
    # Customer Invoice / Delivery Addresses
    # ============================================================
    @http.route(
        "/sale_order/partner_addresses",
        type="json",
        auth="user",
        website=True,
    )
    def partner_addresses(
        self,
        partner_id=None,
        **kwargs
    ):

        # Server-side Sales permission check
        self._check_sales_access()

        if not partner_id:
            return {
                "invoice": [],
                "delivery": [],
                "default_invoice": False,
                "default_delivery": False,
            }

        partner = (
            request.env["res.partner"]
            .sudo()
            .browse(int(partner_id))
            .exists()
        )

        if not partner:
            return {
                "invoice": [],
                "delivery": [],
                "default_invoice": False,
                "default_delivery": False,
            }

        default_addr = partner.address_get(
            ["invoice", "delivery"]
        )

        invoice_children = partner.child_ids.filtered(
            lambda child: child.type == "invoice"
        )

        delivery_children = partner.child_ids.filtered(
            lambda child: child.type == "delivery"
        )

        invoice_list = [
            {
                "id": partner.id,
                "name": partner.name,
            }
        ] + [
            {
                "id": address.id,
                "name": address.display_name,
            }
            for address in invoice_children
        ]

        delivery_list = [
            {
                "id": partner.id,
                "name": partner.name,
            }
        ] + [
            {
                "id": address.id,
                "name": address.display_name,
            }
            for address in delivery_children
        ]

        return {
            "invoice": invoice_list,
            "delivery": delivery_list,
            "default_invoice": default_addr.get(
                "invoice"
            ),
            "default_delivery": default_addr.get(
                "delivery"
            ),
        }

    # ============================================================
    # Create Sale Order
    # ============================================================
    @http.route(
        "/sale_order/submit",
        type="http",
        auth="user",
        website=True,
        methods=["POST"],
        csrf=True,
    )
    def submit_sale_order(self, **kwargs):

        # Server-side Sales permission check
        self._check_sales_access()

        # --------------------------------------------------------
        # Parse Order Lines
        # --------------------------------------------------------
        try:
            lines_payload = json.loads(
                kwargs.get("order_lines_json") or "[]"
            )
        except (ValueError, TypeError):
            lines_payload = []

        untaxed_total = 0
        order_lines = []

        for line in lines_payload:

            product_id = int(
                line.get("product_id") or 0
            )

            qty = float(
                line.get("quantity") or 0
            )

            price_unit = float(
                line.get("price_unit") or 0
            )

            tax_ids = [
                int(tax_id)
                for tax_id in line.get(
                    "tax_ids",
                    []
                )
            ]

            discount = float(
                line.get("discount") or 0
            )

            line_subtotal = (
                price_unit
                * qty
                * (1 - discount / 100)
            )

            untaxed_total += line_subtotal

            if product_id and qty > 0:
                order_lines.append(
                    (
                        0,
                        0,
                        {
                            "product_id": product_id,
                            "product_uom_qty": qty,
                            "price_unit": price_unit,
                            "discount": discount,
                            "tax_ids": [
                                (
                                    6,
                                    0,
                                    tax_ids,
                                )
                            ],
                        },
                    )
                )

        # --------------------------------------------------------
        # Global Discount
        # --------------------------------------------------------
        discount_mode = kwargs.get(
            "discount_mode"
        )

        global_discount_value = float(
            kwargs.get(
                "global_discount_value"
            )
            or 0
        )

        global_discount_amount = 0

        if (
            discount_mode == "global"
            and global_discount_value > 0
        ):
            global_discount_amount = (
                untaxed_total
                * (
                    global_discount_value
                    / 100
                )
            )

        elif (
            discount_mode == "fixed"
            and global_discount_value > 0
        ):
            global_discount_amount = min(
                global_discount_value,
                untaxed_total,
            )

        if global_discount_amount > 0:
            order_lines.append(
                (
                    0,
                    0,
                    {
                        "name": "Discount",
                        "product_uom_qty": 1,
                        "price_unit": (
                            -global_discount_amount
                        ),
                    },
                )
            )

        if not order_lines:
            return request.redirect(
                "/sale_order?error=no_lines"
            )

        # --------------------------------------------------------
        # Customer
        # --------------------------------------------------------
        partner_id = kwargs.get(
            "partner_id"
        )

        if not partner_id:
            return request.redirect(
                "/sale_order?error=no_customer"
            )

        partner_id = int(partner_id)

        # --------------------------------------------------------
        # Quotation Date
        # --------------------------------------------------------
        date_order = kwargs.get(
            "date_order"
        )

        if date_order:
            date_order = date_order.replace(
                "T",
                " ",
            )

            if len(date_order) == 16:
                date_order += ":00"

            date_order = (
                fields.Datetime.to_datetime(
                    date_order
                )
            )

        # --------------------------------------------------------
        # Commitment Date
        # --------------------------------------------------------
        commitment_date = kwargs.get(
            "commitment_date"
        )

        if commitment_date:
            commitment_date = (
                commitment_date.replace(
                    "T",
                    " ",
                )
            )

            if len(commitment_date) == 16:
                commitment_date += ":00"

            commitment_date = (
                fields.Datetime.to_datetime(
                    commitment_date
                )
            )

        # --------------------------------------------------------
        # Sale Tags
        # --------------------------------------------------------
        tag_ids_raw = (
            kwargs.get("tag_ids")
            or ""
        )

        tag_ids = [
            int(tag_id)
            for tag_id
            in tag_ids_raw.split(",")
            if tag_id.strip().isdigit()
        ]

        # --------------------------------------------------------
        # Sale Order Values
        # --------------------------------------------------------
        order_vals = {
            "partner_id": partner_id,

            "partner_invoice_id": (
                int(
                    kwargs[
                        "partner_invoice_id"
                    ]
                )
                if kwargs.get(
                    "partner_invoice_id"
                )
                else partner_id
            ),

            "partner_shipping_id": (
                int(
                    kwargs[
                        "partner_shipping_id"
                    ]
                )
                if kwargs.get(
                    "partner_shipping_id"
                )
                else partner_id
            ),

            "validity_date": (
                kwargs.get(
                    "validity_date"
                )
                or False
            ),

            "date_order": (
                date_order
                or fields.Datetime.now()
            ),

            "pricelist_id": (
                int(kwargs["pricelist_id"])
                if kwargs.get("pricelist_id")
                else False
            ),

            "payment_term_id": (
                int(
                    kwargs[
                        "payment_term_id"
                    ]
                )
                if kwargs.get(
                    "payment_term_id"
                )
                else False
            ),

            "note": kwargs.get("note"),

            "order_line": order_lines,

            "user_id": (
                int(kwargs["user_id"])
                if kwargs.get("user_id")
                else False
            ),

            "team_id": (
                int(kwargs["team_id"])
                if kwargs.get("team_id")
                else False
            ),

            "company_id": (
                int(kwargs["company_id"])
                if kwargs.get("company_id")
                else request.env.company.id
            ),

            "require_signature": bool(
                kwargs.get(
                    "require_signature"
                )
            ),

            "require_payment": bool(
                kwargs.get(
                    "require_payment"
                )
            ),

            "client_order_ref": (
                kwargs.get(
                    "client_order_ref"
                )
                or False
            ),

            "fiscal_position_id": (
                int(
                    kwargs[
                        "fiscal_position_id"
                    ]
                )
                if kwargs.get(
                    "fiscal_position_id"
                )
                else False
            ),

            "warehouse_id": (
                int(
                    kwargs[
                        "warehouse_id"
                    ]
                )
                if kwargs.get(
                    "warehouse_id"
                )
                else False
            ),

            "incoterm": (
                int(kwargs["incoterm"])
                if kwargs.get("incoterm")
                else False
            ),

            "incoterm_location": (
                kwargs.get(
                    "incoterm_location"
                )
                or False
            ),

            "picking_policy": (
                kwargs.get(
                    "picking_policy"
                )
                or False
            ),

            "commitment_date": (
                commitment_date
                or False
            ),

            "origin": (
                kwargs.get("origin")
                or False
            ),

            "opportunity_id": (
                int(
                    kwargs[
                        "opportunity_id"
                    ]
                )
                if kwargs.get(
                    "opportunity_id"
                )
                else False
            ),

            "campaign_id": (
                int(
                    kwargs[
                        "campaign_id"
                    ]
                )
                if kwargs.get(
                    "campaign_id"
                )
                else False
            ),

            "medium_id": (
                int(kwargs["medium_id"])
                if kwargs.get("medium_id")
                else False
            ),

            "source_id": (
                int(kwargs["source_id"])
                if kwargs.get("source_id")
                else False
            ),

            "preferred_payment_method_line_id": (
                int(
                    kwargs[
                        "preferred_payment_method_line_id"
                    ]
                )
                if kwargs.get(
                    "preferred_payment_method_line_id"
                )
                else False
            ),

            "journal_id": (
                int(kwargs["journal_id"])
                if kwargs.get("journal_id")
                else False
            ),
        }

        # --------------------------------------------------------
        # Create Sale Order
        # --------------------------------------------------------
        SaleOrderModel = (
            request.env["sale.order"].sudo()
        )

        if "tag_ids" in SaleOrderModel._fields:
            order_vals["tag_ids"] = [
                (
                    6,
                    0,
                    tag_ids,
                )
            ]

        SaleOrderModel.create(
            order_vals
        )

        return request.redirect(
            "/sale_order?success=1"
        )