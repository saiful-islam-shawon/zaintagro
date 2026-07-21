{
    "name": "ZaintAgro Portal User",

    "version": "19.0.1.0.0",

    "summary": "Manage customer requests through the Odoo portal",

    "author": "zaintagro",

    "category": "Services",

    "license": "LGPL-3",

    "depends": [
        "base",
        "mail",
        "portal",
        "website",
    ],

    "data": [
        
        # website form fields
        'data/website_form_fields.xml',
        
        # homepage
        'views/homepage.xml',
        
        # sidebar template
        'views/sidebar_template.xml',
       
    ],

    "demo": [
        
    ],

    "assets": {
        "web.assets_frontend": [
            # sidebar template
            'zaintagro_portal_user/static/src/scss/sidebar_template.scss',
            
            # crm tags
            'zaintagro_portal_user/static/src/js/crm_tags.js',
        ],
    },

    "installable": True,

    "application": True,

    "auto_install": False,
}