{
    "name": "CRM Portal",
    "version": "19.0.1.0.0",
    "summary": "CRM Portal",
    "description": """
CRM Portal
    """,
    "author": "Saiful Islam Shawon",
    "category": "CRM",
    "license": "LGPL-3",

    "depends": [
        "base",
        "website",
        "portal",
        "crm",
        "utm",
        "account",
    ],

    "data": [
        # Security
        "security/security.xml",
        "security/ir.model.access.csv",

        # Website Template
        "views/crm_template.xml",
        "views/backend_send_mail_views.xml",
        "views/crm_lead_views.xml",
        "views/portal_crm_template.xml",

        # Website Menu
        "views/website_menu.xml",
    ],

    "assets": {
        "web.assets_frontend": [
            "crm_portal/static/src/scss/crm.scss",
            "crm_portal/static/src/js/crm.js",
            
            "crm_portal/static/src/scss/portal_crm.scss",
            "crm_portal/static/src/js/portal_crm.js",
        ],
    },

    "installable": True,
    "application": True,
    "auto_install": False,
}