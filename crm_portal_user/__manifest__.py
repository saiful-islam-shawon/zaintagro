# -*- coding: utf-8 -*-

{
    "name": "CRM Portal User",
    "version": "19.0.1.0.0",
    "summary": "CRM Portal Dashboard for Portal Users",
    "category": "Website",
    "author": "Saiful Islam Shawon",
    "website": "",
    "license": "LGPL-3",

    "depends": [
        "website",
        "crm",
        "portal",
        "mail",
        "utm",
        "sale_stock",
    ],

    "data": [

        # Security
        "security/security.xml",

        # Website Top Navbar
        "views/website_menu.xml",

        # CRM Opportunity
        "views/crm_opportunity_template.xml",

        # Sale Order
        "views/sale_order_template.xml",
    ],

    "assets": {
        "web.assets_frontend": [

            # CRM
            "crm_portal_user/static/src/scss/crm_opportunity.scss",
            "crm_portal_user/static/src/js/crm_tags.js",

            # Sale Order
            "crm_portal_user/static/src/js/sale_order.js",
            "crm_portal_user/static/src/scss/sale_order.scss",
            "crm_portal_user/static/src/js/sale_order_line.js",
        ],
    },

    "application": True,
    "installable": True,
}