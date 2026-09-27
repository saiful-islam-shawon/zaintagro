from odoo import api, fields, models


class CrmLead(models.Model):
    _inherit = "crm.lead"

    lead_creator_id = fields.Many2one(
        "res.users",
        string="Lead Creator",
        default=lambda self: self.env.user,
        readonly=True,
    )

    assign_team = fields.Char(
        string="Assign Team",
    )

    expected_budget = fields.Integer(
        string="Expected Budget",
    )

    product_line_ids = fields.One2many(
        "crm.lead.product",
        "lead_id",
        string="Products",
    )

    product_total = fields.Monetary(
        string="Total",
        currency_field="company_currency",
        compute="_compute_product_total",
    )

    @api.depends("product_line_ids.amount_total")
    def _compute_product_total(self):
        for lead in self:
            lead.product_total = sum(lead.product_line_ids.mapped("amount_total"))

    def action_open_fakir_send_mail(self):
        self.ensure_one()
        return {
            "type": "ir.actions.act_window",
            "name": "Send Mail",
            "res_model": "fakir.crm.send.mail.wizard",
            "view_mode": "form",
            "target": "new",
            "context": {
                "default_lead_id": self.id,
            },
        }
