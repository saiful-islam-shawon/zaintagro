from odoo import http
from odoo.http import request
from werkzeug.exceptions import Forbidden


class CrmPortal(http.Controller):

    def _check_crm_access(self):
        user = request.env.user

        has_crm_access = user.has_group(
            "crm_portal_user.group_crm_website_access"
        )

        is_system_user = user.has_group(
            "base.group_system"
        )

        if not (has_crm_access or is_system_user):
            raise Forbidden(
                "You do not have permission to access CRM."
            )

    @http.route(
        "/create_crm",
        type="http",
        auth="user",
        website=True,
    )
    def create_crm(self, **kwargs):

        self._check_crm_access()

        values = {
            "partner": request.env.user.partner_id,

            "crm_countries": request.env[
                "res.country"
            ].sudo().search(
                [],
                order="name",
            ),

            "crm_states": request.env[
                "res.country.state"
            ].sudo().search(
                [],
                order="name",
            ),

            "crm_campaigns": request.env[
                "utm.campaign"
            ].sudo().search(
                [],
                order="name",
            ),

            "crm_mediums": request.env[
                "utm.medium"
            ].sudo().search(
                [],
                order="name",
            ),

            "crm_sources": request.env[
                "utm.source"
            ].sudo().search(
                [],
                order="name",
            ),

            "crm_tags": request.env[
                "crm.tag"
            ].sudo().search(
                [],
                order="name",
            ),
        }

        return request.render(
            "crm_portal_user.crm_opportunity_template",
            values,
        )

    @http.route(
        "/crm/opportunity/submit",
        type="http",
        auth="user",
        website=True,
        methods=["POST"],
        csrf=True,
    )
    def submit_opportunity(self, **kwargs):

        self._check_crm_access()

        tag_ids_raw = kwargs.get("tag_ids") or ""

        tag_ids = [
            int(tag_id)
            for tag_id in tag_ids_raw.split(",")
            if tag_id.strip().isdigit()
        ]

        lead_vals = {
            "name": kwargs.get("name"),

            "contact_name": kwargs.get(
                "contact_name"
            ),

            "partner_name": kwargs.get(
                "partner_name"
            ),

            "function": kwargs.get(
                "function"
            ),

            "email_from": kwargs.get(
                "email_from"
            ),

            "phone": kwargs.get("phone"),

            "website": kwargs.get(
                "website"
            ),

            "expected_revenue": (
                kwargs.get("expected_revenue")
                or 0.0
            ),

            "date_deadline": (
                kwargs.get("date_deadline")
                or False
            ),

            "street": kwargs.get("street"),

            "street2": kwargs.get("street2"),

            "city": kwargs.get("city"),

            "zip": kwargs.get("zip"),

            "country_id": (
                int(kwargs["country_id"])
                if kwargs.get("country_id")
                else False
            ),

            "state_id": (
                int(kwargs["state_id"])
                if kwargs.get("state_id")
                else False
            ),

            "campaign_id": (
                int(kwargs["campaign_id"])
                if kwargs.get("campaign_id")
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

            "description": kwargs.get(
                "description"
            ),

            "tag_ids": [
                (6, 0, tag_ids)
            ],
        }

        request.env[
            "crm.lead"
        ].sudo().create(
            lead_vals
        )

        return request.redirect(
            "/create_crm?success=1"
        )