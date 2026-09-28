from email.utils import formataddr

from odoo.http import request, route

from odoo.addons.portal.controllers.portal import (

    CustomerPortal,

    pager as portal_pager,

)

from odoo.tools import html2plaintext

from werkzeug.exceptions import Forbidden, NotFound

from markupsafe import escape, Markup





class FakirCustomerPortal(CustomerPortal):



    # =========================================================

    # PORTAL HOME

    # =========================================================



    def _prepare_portal_layout_values(self):

        values = super()._prepare_portal_layout_values()

        user = request.env.user

        has_crm_access = (
            user.has_group("crm_portal.group_crm_website_access")
            or user.has_group("base.group_system")
        )

        values["has_crm_portal_access"] = has_crm_access

        return values

    def _prepare_home_portal_values(self, counters):



        values = super()._prepare_home_portal_values(counters)



        # Odoo 19 portal counters are loaded asynchronously via /my/counters,
        # which returns this whole dict as the JSON response and blindly sets
        # textContent on the matching data-placeholder_count element for
        # EVERY key in it - so this method must NEVER return a key that has
        # no placeholder in the DOM (that is what "has_crm_portal_access"
        # was doing before, and what crashed "My Account"). Only return a
        # counter when the standard portal counter interaction explicitly
        # requests it.
        if "crm_opportunity_count" in counters:
            user = request.env.user
            has_crm_access = (
                user.has_group("crm_portal.group_crm_website_access")
                or user.has_group("base.group_system")
            )
            values["crm_opportunity_count"] = (
                request.env["crm.lead"]
                .sudo()
                .search_count([("type", "=", "opportunity")])
                if has_crm_access
                else 0
            )



        return values





    # =========================================================

    # CHECK CRM PORTAL ACCESS

    # =========================================================



    def _check_crm_portal_access(self):



        user = request.env.user



        has_crm_access = (

            user.has_group(

                "crm_portal.group_crm_website_access"

            )

            or user.has_group("base.group_system")

        )



        if not has_crm_access:

            raise Forbidden()





    # =========================================================

    # CREATE OPPORTUNITY - FORM PAGE

    # =========================================================



    @route(

        ["/create_crm"],

        type="http",

        auth="user",

        website=True,

    )

    def portal_crm_opportunity_create_form(self, **kw):



        self._check_crm_portal_access()



        partner = request.env.user.partner_id



        values = {



            "success": kw.get("success") == "1",



            "partner": partner,



            "partner_phone": (

                partner.phone

                or getattr(partner, "mobile", False)

                or ""

            ),



            "crm_tags": (

                request.env["crm.tag"]

                .sudo()

                .search([], order="name")

            ),



            "crm_countries": (

                request.env["res.country"]

                .sudo()

                .search([], order="name")

            ),



            "crm_states": (

                request.env["res.country.state"]

                .sudo()

                .search([], order="name")

            ),



            "crm_campaigns": (

                request.env["utm.campaign"]

                .sudo()

                .search([], order="name")

            ),



            "crm_mediums": (

                request.env["utm.medium"]

                .sudo()

                .search([], order="name")

            ),



            "crm_sources": (

                request.env["utm.source"]

                .sudo()

                .search([], order="name")

            ),

            "crm_products": (
                request.env["product.product"]
                .sudo()
                .search([("active", "=", True)], order="name")
            ),

            "crm_taxes": request.env["account.tax"].sudo().search([("type_tax_use", "=", "sale")], order="sequence, name"),

            "lead_creator": request.env.user,

        }



        return request.render(

            "crm_portal.crm_opportunity_template",

            values,

        )





    # =========================================================

    # CREATE OPPORTUNITY - FORM SUBMIT

    # =========================================================



    @route(

        ["/crm/opportunity/submit"],

        type="http",

        auth="user",

        website=True,

        methods=["POST"],

    )

    def portal_crm_opportunity_submit(self, **kw):



        self._check_crm_portal_access()



        expected_revenue = (

            kw.get("expected_revenue")

            or 0.0

        )



        try:

            expected_revenue = float(expected_revenue)

        except (TypeError, ValueError):

            expected_revenue = 0.0



        def _int_or_false(value):

            try:

                return int(value)

            except (TypeError, ValueError):

                return False



        tag_ids_raw = (

            kw.get("tag_ids")

            or ""

        ).strip()



        tag_ids = [

            int(tag_id)

            for tag_id in tag_ids_raw.split(",")

            if tag_id.strip().isdigit()

        ]



        expected_budget = kw.get("expected_budget") or 0
        try:
            expected_budget = int(expected_budget)
        except (TypeError, ValueError):
            expected_budget = 0

        product_lines = []
        product_ids_raw = request.httprequest.form.getlist("product_id")
        product_brands = request.httprequest.form.getlist("product_brand")
        product_groups = request.httprequest.form.getlist("product_group")
        product_part_numbers = request.httprequest.form.getlist("product_part_number")
        product_quantities = request.httprequest.form.getlist("product_quantity")
        product_prices = request.httprequest.form.getlist("product_price_unit")
        product_tax_values = request.httprequest.form.getlist("product_tax_ids")

        for index, product_id in enumerate(product_ids_raw):
            try:
                product_id = int(product_id)
            except (TypeError, ValueError):
                continue

            product = request.env["product.product"].sudo().browse(product_id)
            if not product.exists():
                continue

            brand = product_brands[index].strip() if index < len(product_brands) else ""
            product_group = product_groups[index].strip() if index < len(product_groups) else ""
            part_number_raw = product_part_numbers[index].strip() if index < len(product_part_numbers) else ""
            try:
                part_number = int(part_number_raw or 0)
            except (TypeError, ValueError):
                part_number = 0

            try:
                quantity = float(product_quantities[index] or 1.0) if index < len(product_quantities) else 1.0
            except (TypeError, ValueError):
                quantity = 1.0
            try:
                price_unit = float(product_prices[index] or 0.0) if index < len(product_prices) else 0.0
            except (TypeError, ValueError):
                price_unit = 0.0
            tax_raw = product_tax_values[index] if index < len(product_tax_values) else ""
            tax_ids = [int(x) for x in tax_raw.split(",") if x.strip().isdigit()]

            product_lines.append({
                "product_id": product.id,
                "quantity": quantity,
                "price_unit": price_unit,
                "tax_ids": [(6, 0, tax_ids)],
                "brand": brand,
                "product_group": product_group,
                "part_number": part_number,
            })

        vals = {



            "type": "opportunity",



            "name": (

                kw.get("name")

                or "New Opportunity"

            ),



            "expected_revenue": expected_revenue,

            "lead_creator_id": request.env.user.id,
            "assign_team": kw.get("assign_team"),
            "expected_budget": expected_budget,
            "product_line_ids": [
                (0, 0, line_vals)
                for line_vals in product_lines
            ],



            "date_deadline": (

                kw.get("date_deadline")

                or False

            ),



            "tag_ids": [(6, 0, tag_ids)],



            "contact_name": kw.get("contact_name"),

            "partner_name": kw.get("partner_name"),

            "function": kw.get("function"),

            "email_from": kw.get("email_from"),

            "phone": kw.get("phone"),

            "website": kw.get("website"),



            "street": kw.get("street"),

            "street2": kw.get("street2"),

            "city": kw.get("city"),

            "zip": kw.get("zip"),



            "country_id": _int_or_false(

                kw.get("country_id")

            ),



            "state_id": _int_or_false(

                kw.get("state_id")

            ),



            "campaign_id": _int_or_false(

                kw.get("campaign_id")

            ),



            "medium_id": _int_or_false(

                kw.get("medium_id")

            ),



            "source_id": _int_or_false(

                kw.get("source_id")

            ),



            "description": kw.get("description"),



            "partner_id": (

                request.env.user.partner_id.id

            ),

        }



        request.env["crm.lead"].sudo().create(vals)



        return request.redirect(

            "/create_crm?success=1"

        )





    # =========================================================

    # OPPORTUNITY LIST

    # =========================================================



    @route(

        [

            "/my/crm/opportunities",

            "/my/crm/opportunities/page/<int:page>",

        ],

        type="http",

        auth="user",

        website=True,

    )

    def portal_my_crm_opportunities(

        self,

        page=1,

        sortby=None,

        search=None,

        **kw,

    ):



        self._check_crm_portal_access()



        Opportunity = request.env["crm.lead"]





        # =====================================================

        # SORTING OPTIONS

        # =====================================================



        sortings = {



            "date": {

                "label": "Newest",

                "order": "create_date desc",

            },



            "name": {

                "label": "Opportunity",

                "order": "name",

            },



            "revenue": {

                "label": "Expected Revenue",

                "order": "expected_revenue desc",

            },

        }





        # =====================================================

        # DEFAULT SORTING

        # =====================================================



        if not sortby or sortby not in sortings:

            sortby = "date"



        order = sortings[sortby]["order"]





        # =====================================================

        # CLEAN SEARCH VALUE

        # =====================================================



        search = (search or "").strip()





        # =====================================================

        # BASE DOMAIN

        # =====================================================



        domain = [

            ("type", "=", "opportunity"),

        ]





        # =====================================================

        # SEARCH DOMAIN

        #

        # Search in:

        #

        # 1. Opportunity Name

        # 2. Contact / Customer

        # 3. Contact Name

        # 4. Email

        # 5. Phone

        #

        # IMPORTANT:

        # crm.lead does NOT have a "mobile" field in this

        # database, so mobile is intentionally not included.

        # =====================================================



        if search:



            domain += [

                "|",

                "|",

                "|",

                "|",



                ("name", "ilike", search),



                ("partner_id.name", "ilike", search),



                ("contact_name", "ilike", search),



                ("email_from", "ilike", search),



                ("phone", "ilike", search),

            ]





        # =====================================================

        # TOTAL MATCHING OPPORTUNITIES

        # =====================================================



        opportunity_count = (

            Opportunity

            .sudo()

            .search_count(domain)

        )





        # =====================================================

        # PAGINATION

        # =====================================================



        items_per_page = 20



        pager_values = portal_pager(

            url="/my/crm/opportunities",



            url_args={

                "sortby": sortby,

                "search": search,

            },



            total=opportunity_count,



            page=page,



            step=items_per_page,

        )





        # =====================================================

        # CURRENT PAGE OPPORTUNITIES

        # =====================================================



        opportunities = (

            Opportunity

            .sudo()

            .search(

                domain,



                order=order,



                limit=items_per_page,



                offset=pager_values["offset"],

            )

        )





        # =====================================================

        # RESULT RANGE

        #

        # Example:

        #

        # Page 1 = 1 - 20

        # Page 2 = 21 - 40

        # =====================================================



        if opportunity_count:



            result_start = (

                pager_values["offset"] + 1

            )



            result_end = (

                pager_values["offset"]

                + len(opportunities)

            )



        else:



            result_start = 0

            result_end = 0





        # =====================================================

        # SEND MAIL STATUS

        # =====================================================



        mail_sent = kw.get("mail_sent") == "1"

        mail_error = (kw.get("mail_error") or "").strip()





        # =====================================================

        # TEMPLATE VALUES

        # =====================================================



        values = {



            "opportunities": opportunities,



            "page_name": "crm_opportunity",



            "pager": pager_values,



            "sortby": sortby,



            "sortings": sortings,



            "search": search,



            "opportunity_count": opportunity_count,



            "result_start": result_start,



            "result_end": result_end,



            "default_url": "/my/crm/opportunities",

        }





        # =====================================================

        # RENDER

        # =====================================================



        return request.render(

            "crm_portal."

            "portal_my_crm_opportunities",

            values,

        )





    # =========================================================

    # GET OPPORTUNITY

    # =========================================================



    def _get_crm_opportunity(self, opportunity_id):



        opportunity = (

            request.env["crm.lead"]

            .sudo()

            .browse(opportunity_id)

        )



        if (

            not opportunity.exists()

            or opportunity.type != "opportunity"

        ):

            raise NotFound()



        return opportunity





    # =========================================================

    # OPPORTUNITY DETAIL / EDIT

    # =========================================================



    @route(

        ["/my/crm/opportunities/<int:opportunity_id>"],

        type="http",

        auth="user",

        website=True,

        methods=["GET", "POST"],

    )

    def portal_crm_opportunity_detail(

        self,

        opportunity_id,

        **kw,

    ):



        self._check_crm_portal_access()



        opportunity = self._get_crm_opportunity(

            opportunity_id

        )



        success = False

        # Send Mail status

        mail_sent = request.params.get("mail_sent")

        mail_error = request.params.get("mail_error")





        # =====================================================

        # QUICK STAGE CHANGE

        # =====================================================



        if (

            request.httprequest.method == "GET"

            and kw.get("stage_id")

        ):



            try:

                stage_id = int(

                    kw.get("stage_id")

                )



            except (TypeError, ValueError):

                stage_id = False



            if stage_id:



                stage = (

                    request.env["crm.stage"]

                    .sudo()

                    .browse(stage_id)

                )



                if stage.exists():



                    opportunity.sudo().write({

                        "stage_id": stage.id,

                    })



            return request.redirect(

                "/my/crm/opportunities/%s"

                % opportunity.id

            )





        # =====================================================

        # UPDATE OPPORTUNITY

        # =====================================================



        if request.httprequest.method == "POST":



            expected_revenue = (

                kw.get("expected_revenue")

                or 0.0

            )



            try:



                expected_revenue = float(

                    expected_revenue

                )



            except (TypeError, ValueError):



                expected_revenue = (

                    opportunity.expected_revenue

                )





            tag_ids = (

                request.httprequest.form

                .getlist("tag_ids")

            )





            def _int_or_false(value):



                try:

                    return int(value)



                except (TypeError, ValueError):

                    return False





            # =====================================================

            # SALESPERSON VALIDATION

            # =====================================================



            requested_user_id = _int_or_false(

                kw.get("user_id")

            )



            salesperson_id = False



            if requested_user_id:

                salesperson = (

                    request.env["res.users"]

                    .sudo()

                    .search(

                        [

                            ("id", "=", requested_user_id),

                            ("active", "=", True),

                            ("share", "=", False),

                        ],

                        limit=1,

                    )

                )



                if salesperson:

                    salesperson_id = salesperson.id





            expected_budget = kw.get("expected_budget")
            try:
                expected_budget = int(expected_budget or 0)
            except (TypeError, ValueError):
                expected_budget = opportunity.expected_budget

            product_lines = []
            product_ids_raw = request.httprequest.form.getlist("product_id")
            product_brands = request.httprequest.form.getlist("product_brand")
            product_groups = request.httprequest.form.getlist("product_group")
            product_part_numbers = request.httprequest.form.getlist("product_part_number")
            product_quantities = request.httprequest.form.getlist("product_quantity")
            product_prices = request.httprequest.form.getlist("product_price_unit")
            product_tax_values = request.httprequest.form.getlist("product_tax_ids")

            for index, product_id in enumerate(product_ids_raw):
                try:
                    product_id = int(product_id)
                except (TypeError, ValueError):
                    continue

                product = request.env["product.product"].sudo().browse(product_id)
                if not product.exists():
                    continue

                brand = product_brands[index].strip() if index < len(product_brands) else ""
                product_group = product_groups[index].strip() if index < len(product_groups) else ""
                part_number_raw = product_part_numbers[index].strip() if index < len(product_part_numbers) else ""
                try:
                    part_number = int(part_number_raw or 0)
                except (TypeError, ValueError):
                    part_number = 0

                try:
                    quantity = float(product_quantities[index] or 1.0) if index < len(product_quantities) else 1.0
                except (TypeError, ValueError):
                    quantity = 1.0
                try:
                    price_unit = float(product_prices[index] or 0.0) if index < len(product_prices) else 0.0
                except (TypeError, ValueError):
                    price_unit = 0.0
                tax_raw = product_tax_values[index] if index < len(product_tax_values) else ""
                tax_ids = [int(x) for x in tax_raw.split(",") if x.strip().isdigit()]

                product_lines.append({
                    "product_id": product.id,
                    "quantity": quantity,
                    "price_unit": price_unit,
                    "tax_ids": [(6, 0, tax_ids)],
                    "brand": brand,
                    "product_group": product_group,
                    "part_number": part_number,
                })

            vals = {



                # =============================================

                # BASIC / NOTES

                # =============================================



                "name": (

                    kw.get("name")

                    or opportunity.name

                ),



                "contact_name": kw.get(

                    "contact_name"

                ),



                "email_from": kw.get(

                    "email_from"

                ),



                "phone": kw.get(

                    "phone"

                ),



                "expected_revenue": (

                    expected_revenue

                ),

                "assign_team": kw.get("assign_team"),
                "expected_budget": expected_budget,
                "product_line_ids": [
                    (5, 0, 0),
                    *[(0, 0, line_vals) for line_vals in product_lines],
                ],



                "date_deadline": (

                    kw.get("date_deadline")

                    or False

                ),



                "description": kw.get(

                    "description"

                ),



                "tag_ids": [

                    (

                        6,

                        0,

                        [

                            int(tag)

                            for tag in tag_ids

                            if str(tag).isdigit()

                        ],

                    )

                ],





                # =============================================

                # COMPANY INFORMATION

                # =============================================



                "partner_name": kw.get(

                    "partner_name"

                ),



                "street": kw.get(

                    "street"

                ),



                "street2": kw.get(

                    "street2"

                ),



                "city": kw.get(

                    "city"

                ),



                "zip": kw.get(

                    "zip"

                ),



                "state_id": _int_or_false(

                    kw.get("state_id")

                ),



                "country_id": _int_or_false(

                    kw.get("country_id")

                ),





                # =============================================

                # CONTACT INFORMATION

                # =============================================



                "function": kw.get(

                    "function"

                ),



                "website": kw.get(

                    "website"

                ),





                # =============================================

                # MARKETING

                # =============================================



                "campaign_id": _int_or_false(

                    kw.get("campaign_id")

                ),



                "medium_id": _int_or_false(

                    kw.get("medium_id")

                ),



                "source_id": _int_or_false(

                    kw.get("source_id")

                ),



                "referred": kw.get(

                    "referred"

                ),





                # =============================================

                # OWNERSHIP

                # =============================================



                "team_id": _int_or_false(

                    kw.get("team_id")

                ),



                "user_id": salesperson_id,

            }





            opportunity.sudo().write(vals)



            success = True





        # =====================================================

        # ACTIVITY TYPES

        # =====================================================



        activity_types = (

            request.env["mail.activity.type"]

            .sudo()

            .search(

                [],

                order="id",

            )

        )





        # =====================================================

        # INTERNAL USERS FOR ACTIVITY

        # =====================================================



        activity_users = (

            request.env["res.users"]

            .sudo()

            .search(

                [

                    ("active", "=", True),

                    ("share", "=", False),

                ],

                order="name",

            )

        )





        # =====================================================

        # TEMPLATE VALUES

        # =====================================================



        # =====================================================
        # DEFAULT EDITABLE EMAIL TEMPLATE
        # =====================================================

        description_plain = html2plaintext(
            opportunity.description or ""
        ).strip()

        priority_field = opportunity._fields.get("priority")
        priority_label = "Normal"
        if priority_field and opportunity.priority:
            selection = priority_field.selection
            if callable(selection):
                selection = selection(request.env["crm.lead"])
            priority_label = dict(selection or []).get(
                opportunity.priority,
                opportunity.priority,
            )

        expected_revenue = (
            "%0.2f" % opportunity.expected_revenue
            if opportunity.expected_revenue
            else "TBD"
        )

        default_mail_subject = (
            "Regarding: %s" % (opportunity.name or "Opportunity")
        )

        default_mail_body = "\n".join([
            "Hi Team,",
            "",
            "Hope you're having a good week.",
            "",
            "I’ve just created a new lead in our Odoo CRM and wanted to loop you in so your team can review the requirements and take any necessary next steps.",
            "",
            "Here is a quick overview:",
            "",
            "• Lead / Opportunity: %s" % (opportunity.name or "N/A"),
            "• Company / Client: %s" % (
                opportunity.partner_id.name
                or opportunity.contact_name
                or "N/A"
            ),
            "• Contact Person: %s (%s)" % (
                opportunity.contact_name or "N/A",
                opportunity.email_from or "No email provided",
            ),
            "• Expected Revenue: %s" % expected_revenue,
            "• Priority: %s" % priority_label,
            "",
            "• Key Notes / Scope:",
            description_plain or "Please check Odoo for full notes.",
            "",
            "Direct Link to Lead:",
            "",
            "Please feel free to jump in, update the chatter, or reach out if anything needs clarification.",
            "",
            "Thanks!",
        ])

        values = {



            "opportunity": opportunity,



            "description_plain": description_plain,

            "default_mail_subject": default_mail_subject,

            "default_mail_body": default_mail_body,





            # =============================================

            # CRM DATA

            # =============================================



            "stages": (

                request.env["crm.stage"]

                .sudo()

                .search(

                    [],

                    order="sequence, id",

                )

            ),



            "lost_reasons": (

                request.env["crm.lost.reason"]

                .sudo()

                .search([], order="name")

            ),



            "all_tags": (

                request.env["crm.tag"]

                .sudo()

                .search(

                    [],

                    order="name",

                )

            ),



            "crm_countries": (

                request.env["res.country"]

                .sudo()

                .search(

                    [],

                    order="name",

                )

            ),



            "crm_states": (

                request.env["res.country.state"]

                .sudo()

                .search(

                    [],

                    order="name",

                )

            ),



            "crm_campaigns": (

                request.env["utm.campaign"]

                .sudo()

                .search(

                    [],

                    order="name",

                )

            ),



            "crm_mediums": (

                request.env["utm.medium"]

                .sudo()

                .search(

                    [],

                    order="name",

                )

            ),



            "crm_sources": (

                request.env["utm.source"]

                .sudo()

                .search(

                    [],

                    order="name",

                )

            ),



            "crm_teams": (

                request.env["crm.team"]

                .sudo()

                .search(

                    [],

                    order="name",

                )

            ),





            "crm_products": (
                request.env["product.product"]
                .sudo()
                .search([("active", "=", True)], order="name")
            ),

            "crm_taxes": request.env["account.tax"].sudo().search([("type_tax_use", "=", "sale")], order="sequence, name"),

            # =============================================

            # CHATTER

            # =============================================



            "messages": (

                opportunity.message_ids

            ),





            # =============================================

            # ACTIVITIES

            # =============================================



            "activities": (

                opportunity.activity_ids

            ),



            "activity_types": activity_types,



            "activity_users": activity_users,

            "activity_note_texts": {
                activity.id: html2plaintext(activity.note or "").strip()
                for activity in opportunity.activity_ids
            },



            # =============================================

            # OTHER

            # =============================================



            "success": success,

            "mail_sent": mail_sent,

            "mail_error": mail_error,



            "page_name": (

                "crm_opportunity_detail"

            ),

        }





        return request.render(

            "crm_portal."

            "portal_my_crm_opportunity_detail",

            values,

        )





    # =========================================================

    # OPPORTUNITY - MARK WON

    # =========================================================



    @route(

        ["/my/crm/opportunities/<int:opportunity_id>/won"],

        type="http",

        auth="user",

        website=True,

        methods=["POST"],

    )

    def portal_crm_opportunity_mark_won(self, opportunity_id, **kw):



        self._check_crm_portal_access()

        opportunity = self._get_crm_opportunity(opportunity_id)



        # Odoo 19 standard CRM business logic.

        opportunity.sudo().action_set_won_rainbowman()



        return request.redirect(

            "/my/crm/opportunities/%s" % opportunity.id

        )





    # =========================================================

    # OPPORTUNITY - MARK LOST

    # =========================================================



    @route(

        ["/my/crm/opportunities/<int:opportunity_id>/lost"],

        type="http",

        auth="user",

        website=True,

        methods=["POST"],

    )

    def portal_crm_opportunity_mark_lost(self, opportunity_id, **kw):



        self._check_crm_portal_access()

        opportunity = self._get_crm_opportunity(opportunity_id)



        lost_reason_id = kw.get("lost_reason_id")

        closing_note = (kw.get("closing_note") or "").strip()



        try:

            lost_reason_id = int(lost_reason_id) if lost_reason_id else False

        except (TypeError, ValueError):

            lost_reason_id = False



        if lost_reason_id:

            lost_reason = (

                request.env["crm.lost.reason"]

                .sudo()

                .browse(lost_reason_id)

            )

            if lost_reason.exists():

                opportunity.sudo().write({

                    "lost_reason_id": lost_reason.id,

                })



        # Odoo 19 standard CRM lost logic.

        opportunity.sudo().action_set_lost()



        if closing_note:

            opportunity.sudo().message_post(

                body=closing_note,

                message_type="comment",

                subtype_xmlid="mail.mt_note",

            )



        return request.redirect(

            "/my/crm/opportunities/%s" % opportunity.id

        )





    # =========================================================
    # OPPORTUNITY - SEND MAIL
    # =========================================================

    @route(
        [
            "/my/crm/opportunities/"
            "<int:opportunity_id>/send_mail"
        ],
        type="http",
        auth="user",
        website=True,
        methods=["POST"],
        csrf=True,
    )
    def portal_crm_opportunity_send_mail(
        self,
        opportunity_id,
        **kw,
    ):

        self._check_crm_portal_access()
        opportunity = self._get_crm_opportunity(opportunity_id)

        email_to = (kw.get("email_to") or "").strip()
        subject = (kw.get("subject") or "").strip()
        message_body = (kw.get("message_body") or "").strip()

        redirect_url = (
            "/my/crm/opportunities/%s" % opportunity.id
        )

        # =====================================================
        # BASIC VALIDATION
        # =====================================================

        if not email_to or "@" not in email_to:
            return request.redirect(
                redirect_url + "?mail_error=invalid_email"
            )

        if not subject:
            return request.redirect(
                redirect_url + "?mail_error=missing_subject"
            )

        if not message_body:
            return request.redirect(
                redirect_url + "?mail_error=missing_message"
            )

        # =====================================================
        # FIND ACTIVE ODOO USER BY EMAIL
        # =====================================================

        recipient_users = (
            request.env["res.users"]
            .sudo()
            .search(
                [
                    ("email", "=ilike", email_to),
                    ("active", "=", True),
                ]
            )
        )

        # =====================================================
        # CHECK CRM ACCESS
        # =====================================================

        recipient_user = False

        for user in recipient_users:
            if (
                user.has_group(
                    "crm_portal."
                    "group_crm_website_access"
                )
                or user.has_group("base.group_system")
            ):
                recipient_user = user
                break

        if not recipient_user:
            return request.redirect(
                redirect_url + "?mail_error=no_crm_access"
            )

        # =====================================================
        # BUILD OPPORTUNITY URL
        # =====================================================

        base_url = (
            request.env["ir.config_parameter"]
            .sudo()
            .get_param("web.base.url")
        )

        opportunity_url = (
            "%s/my/crm/opportunities/%s"
            % (
                base_url.rstrip("/"),
                opportunity.id,
            )
        )

        # =====================================================
        # BUILD CLEAN, ORGANIZED HTML EMAIL
        # =====================================================

        # The message comes from an editable plain-text textarea.
        # Build email-safe HTML line by line so Gmail/Outlook keep
        # the intended spacing instead of collapsing everything.
        message_lines = message_body.replace("\r\n", "\n").replace("\r", "\n").split("\n")

        html_parts = []
        button_inserted = False

        for raw_line in message_lines:
            line = raw_line.strip()

            # Preserve intentional blank lines as vertical spacing.
            if not line:
                html_parts.append('<div style="height: 10px; line-height: 10px;">&nbsp;</div>')
                continue

            # Put the portal button exactly below "Direct Link to Lead:".
            if line.lower() == "direct link to lead:":
                html_parts.append(
                    '<div style="margin-top: 18px; margin-bottom: 10px; '
                    'font-weight: 700; color: #333333;">Direct Link to Lead:</div>'
                )
                html_parts.append(
                    '<div style="margin: 0 0 18px 0;">'
                    '<a href="%s" style="display: inline-block; '
                    'background-color: #714b67; color: #ffffff; '
                    'padding: 11px 20px; text-decoration: none; '
                    'border-radius: 5px; font-weight: 600;">'
                    'View Opportunity</a></div>'
                    % escape(opportunity_url)
                )
                button_inserted = True
                continue

            # Make the overview heading visually distinct.
            if line.lower() == "here is a quick overview:":
                html_parts.append(
                    '<div style="margin-top: 14px; margin-bottom: 8px; '
                    'font-weight: 700; color: #333333;">'
                    'Here is a quick overview:</div>'
                )
                continue

            # Format bullet rows and bold the label before the first colon.
            if line.startswith("•"):
                bullet_text = line[1:].strip()
                if ":" in bullet_text:
                    label, value = bullet_text.split(":", 1)
                    html_parts.append(
                        '<div style="margin: 5px 0 5px 14px;">'
                        '<span style="margin-right: 7px;">&#8226;</span>'
                        '<strong>%s:</strong>%s</div>'
                        % (escape(label.strip()), escape(value))
                    )
                else:
                    html_parts.append(
                        '<div style="margin: 5px 0 5px 14px;">'
                        '<span style="margin-right: 7px;">&#8226;</span>%s</div>'
                        % escape(bullet_text)
                    )
                continue

            # Normal editable text becomes its own clean line/paragraph.
            html_parts.append(
                '<div style="margin: 0 0 8px 0;">%s</div>'
                % escape(line)
            )

        # Safety fallback: if the user removes the Direct Link section while
        # editing, still provide the View Opportunity button at the end.
        if not button_inserted:
            html_parts.append(
                '<div style="margin-top: 20px; padding-top: 18px; '
                'border-top: 1px solid #e5e5e5;">'
                '<div style="margin-bottom: 10px; font-weight: 700;">'
                'Direct Link to Lead:</div>'
                '<a href="%s" style="display: inline-block; '
                'background-color: #714b67; color: #ffffff; '
                'padding: 11px 20px; text-decoration: none; '
                'border-radius: 5px; font-weight: 600;">'
                'View Opportunity</a></div>'
                % escape(opportunity_url)
            )

        organized_message_html = Markup("".join(html_parts))

        email_body = Markup(
            '<div style="font-family: Arial, Helvetica, sans-serif; '
            'font-size: 14px; line-height: 1.6; color: #333333; '
            'max-width: 680px; margin: 0; padding: 0;">{message}</div>'
        ).format(message=organized_message_html)

        # A clean version is also used in Chatter history.
        chatter_message_html = Markup(
            str(escape(message_body)).replace("\n", "<br/>")
        )

        # =====================================================
        # EMAIL FROM
        # =====================================================

        sender_user = request.env.user
        sender_email = (sender_user.email or "").strip()
        if not sender_email:
            return request.redirect(
                redirect_url + "?mail_error=missing_sender_email"
            )

        email_from = formataddr((sender_user.name or "", sender_email))

        # =====================================================
        # CREATE + SEND EMAIL
        # =====================================================

        mail = (
            request.env["mail.mail"]
            .sudo()
            .create({
                "subject": subject,
                "body_html": email_body,
                "email_to": email_to,
                "email_from": email_from,
                "model": "crm.lead",
                "res_id": opportunity.id,
            })
        )

        mail.send()

        # =====================================================
        # CHATTER HISTORY
        # =====================================================

        log_body = Markup(
            "<p><strong>Email sent</strong></p>"
            "<p><strong>To:</strong> {email_to}</p>"
            "<p><strong>Subject:</strong> {subject}</p>"
            "<div>{message_body}</div>"
        ).format(
            email_to=escape(email_to),
            subject=escape(subject),
            message_body=chatter_message_html,
        )

        opportunity.sudo().message_post(
            body=log_body,
            message_type="comment",
            subtype_xmlid="mail.mt_comment",
        )

        return request.redirect(
            redirect_url + "?mail_sent=1"
        )


    # =========================================================

    # CHATTER - POST MESSAGE / LOG NOTE

    # =========================================================



    @route(

        [

            "/my/crm/opportunities/"

            "<int:opportunity_id>/post_message"

        ],

        type="http",

        auth="user",

        website=True,

        methods=["POST"],

        csrf=True,

    )

    def portal_crm_opportunity_post_message(

        self,

        opportunity_id,

        **kw,

    ):



        self._check_crm_portal_access()



        opportunity = self._get_crm_opportunity(opportunity_id)



        message_body = (kw.get("message_body") or "").strip()

        message_mode = (kw.get("message_mode") or "message").strip()



        if message_body:

            subtype_xmlid = (

                "mail.mt_note"

                if message_mode == "note"

                else "mail.mt_comment"

            )



            opportunity.sudo().message_post(

                body=message_body,

                message_type="comment",

                subtype_xmlid=subtype_xmlid,

            )



        return request.redirect(

            "/my/crm/opportunities/%s" % opportunity.id

        )





    # =========================================================

    # ACTIVITY - EXISTING ACTIVITY ACTIONS

    # =========================================================

    def _get_portal_opportunity_activity(self, opportunity, activity_id):
        try:
            activity_id = int(activity_id)
        except (TypeError, ValueError):
            raise NotFound()

        activity = request.env["mail.activity"].sudo().browse(activity_id)
        if (
            not activity.exists()
            or activity.res_model != "crm.lead"
            or activity.res_id != opportunity.id
        ):
            raise NotFound()
        return activity

    @route(
        ["/my/crm/opportunities/<int:opportunity_id>/activity/<int:activity_id>/done"],
        type="http", auth="user", website=True, methods=["POST"],
    )
    def portal_crm_activity_done(self, opportunity_id, activity_id, **kw):
        self._check_crm_portal_access()
        opportunity = self._get_crm_opportunity(opportunity_id)
        activity = self._get_portal_opportunity_activity(opportunity, activity_id)
        feedback = (kw.get("feedback") or "").strip() or False
        activity.action_feedback(feedback=feedback)
        return request.redirect("/my/crm/opportunities/%s" % opportunity.id)

    @route(
        ["/my/crm/opportunities/<int:opportunity_id>/activity/<int:activity_id>/cancel"],
        type="http", auth="user", website=True, methods=["POST"],
    )
    def portal_crm_activity_cancel(self, opportunity_id, activity_id, **kw):
        self._check_crm_portal_access()
        opportunity = self._get_crm_opportunity(opportunity_id)
        activity = self._get_portal_opportunity_activity(opportunity, activity_id)
        activity.unlink()
        return request.redirect("/my/crm/opportunities/%s" % opportunity.id)

    @route(
        ["/my/crm/opportunities/<int:opportunity_id>/activity/<int:activity_id>/edit"],
        type="http", auth="user", website=True, methods=["POST"],
    )
    def portal_crm_activity_edit(self, opportunity_id, activity_id, **kw):
        self._check_crm_portal_access()
        opportunity = self._get_crm_opportunity(opportunity_id)
        activity = self._get_portal_opportunity_activity(opportunity, activity_id)

        try:
            activity_type_id = int(kw.get("activity_type_id"))
        except (TypeError, ValueError):
            activity_type_id = False
        activity_type = request.env["mail.activity.type"].sudo().browse(activity_type_id)
        if not activity_type_id or not activity_type.exists():
            return request.redirect("/my/crm/opportunities/%s" % opportunity.id)

        date_deadline = kw.get("date_deadline")
        if not date_deadline:
            return request.redirect("/my/crm/opportunities/%s" % opportunity.id)

        try:
            user_id = int(kw.get("user_id"))
        except (TypeError, ValueError):
            user_id = False
        assigned_user = request.env["res.users"].sudo().search([
            ("id", "=", user_id), ("active", "=", True), ("share", "=", False)
        ], limit=1) if user_id else False
        if not assigned_user:
            return request.redirect("/my/crm/opportunities/%s" % opportunity.id)

        activity.write({
            "activity_type_id": activity_type.id,
            "summary": (kw.get("summary") or "").strip() or False,
            "date_deadline": date_deadline,
            "user_id": assigned_user.id,
            "note": (kw.get("note") or "").strip() or False,
        })
        return request.redirect("/my/crm/opportunities/%s" % opportunity.id)


    # =========================================================

    # ACTIVITY - SAVE / MARK DONE

    # =========================================================



    @route(

        [

            "/my/crm/opportunities/"

            "<int:opportunity_id>/schedule_activity"

        ],

        type="http",

        auth="user",

        website=True,

        methods=["POST"],

    )

    def portal_crm_opportunity_schedule_activity(

        self,

        opportunity_id,

        **kw,

    ):



        self._check_crm_portal_access()



        opportunity = (

            self._get_crm_opportunity(

                opportunity_id

            )

        )





        # =====================================================

        # FORM VALUES

        # =====================================================



        activity_type_id = kw.get(

            "activity_type_id"

        )



        summary = (

            kw.get("summary")

            or ""

        ).strip()



        note = (

            kw.get("note")

            or ""

        ).strip()



        date_deadline = kw.get(

            "date_deadline"

        )



        user_id = kw.get(

            "user_id"

        )



        action = (

            kw.get("action")

            or "save"

        )





        # =====================================================

        # CONVERT ACTIVITY TYPE

        # =====================================================



        try:



            activity_type_id = int(

                activity_type_id

            )



        except (TypeError, ValueError):



            activity_type_id = False





        # =====================================================

        # CONVERT USER

        # =====================================================



        try:



            user_id = int(

                user_id

            )



        except (TypeError, ValueError):



            user_id = False





        # =====================================================

        # VALIDATE ACTIVITY TYPE

        # =====================================================



        if not activity_type_id:



            return request.redirect(

                "/my/crm/opportunities/%s"

                % opportunity.id

            )





        activity_type = (

            request.env["mail.activity.type"]

            .sudo()

            .browse(activity_type_id)

        )



        if not activity_type.exists():



            return request.redirect(

                "/my/crm/opportunities/%s"

                % opportunity.id

            )





        # =====================================================

        # VALIDATE DUE DATE

        # =====================================================



        if not date_deadline:



            return request.redirect(

                "/my/crm/opportunities/%s"

                % opportunity.id

            )





        # =====================================================

        # ASSIGNED USER

        # =====================================================



        assigned_user = False





        if user_id:



            assigned_user = (

                request.env["res.users"]

                .sudo()

                .search(

                    [

                        ("id", "=", user_id),

                        ("active", "=", True),

                        ("share", "=", False),

                    ],

                    limit=1,

                )

            )





        # Opportunity salesperson



        if not assigned_user and opportunity.user_id:



            if (

                opportunity.user_id.active

                and not opportunity.user_id.share

            ):



                assigned_user = (

                    opportunity.user_id

                )





        # Any internal user as fallback



        if not assigned_user:



            assigned_user = (

                request.env["res.users"]

                .sudo()

                .search(

                    [

                        ("active", "=", True),

                        ("share", "=", False),

                    ],

                    order="id",

                    limit=1,

                )

            )





        if not assigned_user:



            return request.redirect(

                "/my/crm/opportunities/%s"

                % opportunity.id

            )





        # =====================================================

        # CREATE ACTIVITY

        # =====================================================



        activity = (

            opportunity

            .sudo()

            .activity_schedule(

                activity_type_id=activity_type.id,

                date_deadline=date_deadline,

                summary=summary or False,

                note=note or False,

                user_id=assigned_user.id,

            )

        )





        # =====================================================

        # MARK DONE

        # =====================================================



        if action == "done":



            activity.sudo().action_feedback(

                feedback=note or False

            )





        # =====================================================

        # REDIRECT

        # =====================================================



        return request.redirect(

            "/my/crm/opportunities/%s"

            % opportunity.id

        )