# Zencore Talukder Purchase Approval - Odoo 18

## Requirement

Every approved purchase approval request must create a NEW RFQ.

The customization never searches for and reuses an older draft RFQ.

## Vendor handling

The vendor is read from the approval PRODUCT LINE, not from a main
approval.request vendor field.

Example:

- Product A -> Vendor X
- Product B -> Vendor X
- Product C -> Vendor Y

Result for that approval:

- New RFQ for Vendor X containing Product A + Product B
- New RFQ for Vendor Y containing Product C

If another approval is created later for Vendor X, another NEW RFQ is created.

## Upgrade

If version 18.0.1.0.0 was installed already:

1. Replace the old module folder with this version.
2. Restart Odoo.
3. Upgrade `zencore_talukder_purchase_approval`.
4. Test on a test database first.

## Scope

Only Approval -> RFQ generation is overridden. Normal Purchase app behavior
is not intentionally modified.
