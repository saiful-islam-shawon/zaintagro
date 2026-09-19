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
        
        # security
        'security/security.xml',
        
        # default homepage
        'views/default_homepage.xml',
        
        # homepage
        'views/homepage.xml',

        # sidebar_template
        'views/sidebar_template.xml',
        
        # sale order template
        'views/sale_order_template.xml',
    ],
    "assets": {
        "web.assets_frontend": [
            
            # sidebar template
            'crm_portal_user/static/src/scss/sidebar_template.scss',

            # crm tags
            'crm_portal_user/static/src/js/crm_tags.js',
            
            # sale order
            'crm_portal_user/static/src/js/sale_order.js',
            'crm_portal_user/static/src/scss/sale_order.scss',
            
            # sale order line
            'crm_portal_user/static/src/js/sale_order_line.js',
        ],
    },
    "application": True,
    "installable": True,
}