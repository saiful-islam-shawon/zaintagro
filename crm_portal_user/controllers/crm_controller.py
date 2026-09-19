from odoo import http
from odoo.http import request


class CrmPortal(http.Controller):

    @http.route("/create_crm", type="http", auth="user", website=True)
    def homepage(self, **kwargs):
               
        # code start
        values = {
            "partner": request.env.user.partner_id,
            "crm_countries": request.env["res.country"].sudo().search([], order="name"),
            "crm_states": request.env["res.country.state"].sudo().search([], order="name"),
            "crm_campaigns": request.env["utm.campaign"].sudo().search([], order="name"),
            "crm_mediums": request.env["utm.medium"].sudo().search([], order="name"),
            "crm_sources": request.env["utm.source"].sudo().search([], order="name"),
            "crm_tags": request.env["crm.tag"].sudo().search([], order="name"),
        }
        return request.render("crm_portal_user.homepage", values)

    @http.route("/crm/opportunity/submit", type="http", auth="user", website=True, methods=["POST"], csrf=True)
    def submit_opportunity(self, **kwargs):
        tag_ids_raw = kwargs.get("tag_ids") or ""
        tag_ids = [int(tid) for tid in tag_ids_raw.split(",") if tid.strip().isdigit()]

        lead_vals = {
            "name": kwargs.get("name"),
            "contact_name": kwargs.get("contact_name"),
            "partner_name": kwargs.get("partner_name"),
            "function": kwargs.get("function"),
            "email_from": kwargs.get("email_from"),
            "phone": kwargs.get("phone"),
            "website": kwargs.get("website"),
            "expected_revenue": kwargs.get("expected_revenue") or 0.0,
            "date_deadline": kwargs.get("date_deadline") or False,
            "street": kwargs.get("street"),
            "street2": kwargs.get("street2"),
            "city": kwargs.get("city"),
            "zip": kwargs.get("zip"),
            "country_id": int(kwargs["country_id"]) if kwargs.get("country_id") else False,
            "state_id": int(kwargs["state_id"]) if kwargs.get("state_id") else False,
            "campaign_id": int(kwargs["campaign_id"]) if kwargs.get("campaign_id") else False,
            "medium_id": int(kwargs["medium_id"]) if kwargs.get("medium_id") else False,
            "source_id": int(kwargs["source_id"]) if kwargs.get("source_id") else False,
            "description": kwargs.get("description"),
            "tag_ids": [(6, 0, tag_ids)],
        }

        request.env["crm.lead"].sudo().create(lead_vals)

        return request.redirect("/?success=1")