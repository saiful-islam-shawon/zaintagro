/** @odoo-module **/

import publicWidget from "@web/legacy/js/public/public_widget";


publicWidget.registry.SaleOrderLines = publicWidget.Widget.extend({
    selector: "#sale_order_form",

    events: {
        "click #so_add_line": "_onAddLine",
        "click .so_remove_line": "_onRemoveLine",
        "input .so_product_search": "_onProductSearch",
        "focus .so_product_search": "_onProductSearch",
        "click .so_product_suggestion_item": "_onSelectProduct",
        "input .so_qty_input": "_onQtyChange",
        "input .so_unit_price_display": "_onUnitPriceChange",
        "click .so_tax_dropdown_menu": "_onTaxMenuClick",
        "change .so_tax_checkbox": "_onTaxChange",
        "submit": "_onSubmit",
        "input .so_discount_input": "_onDiscountChange",
        "click #so_apply_discount": "_onApplyDiscount",
        "change input[name='so_discount_mode_choice']": "_onDiscountModeChange",
        "input #so_customer_search": "_onCustomerSearch",
        "focus #so_customer_search": "_onCustomerSearch",
        "click .so_customer_suggestion_item": "_onSelectCustomer",
        "input #so_pricelist_search": "_onPricelistSearch",
        "focus #so_pricelist_search": "_onPricelistSearch",
        "click .so_pricelist_suggestion_item": "_onSelectPricelist",
        "input #so_payment_term_search": "_onPaymentTermSearch",
        "focus #so_payment_term_search": "_onPaymentTermSearch",
        "click .so_payment_term_suggestion_item": "_onSelectPaymentTerm",
        "input .so_tax_search": "_onTaxSearch",
    },

    async start() {
        await this._super(...arguments);

        this.linesContainer = this.el.querySelector("#so_order_lines_container");
        this.grandTotalEl = this.el.querySelector("#so_grand_total");
        this.untaxedTotalEl = this.el.querySelector("#so_untaxed_total");
        this.taxTotalEl = this.el.querySelector("#so_tax_total");

        this._onDocumentClickBound = this._onDocumentClick.bind(this);
        document.addEventListener("click", this._onDocumentClickBound);

        this._toggleRemoveButtons();
        this._recalculateTotal();
    },

    destroy() {
        if (this._onDocumentClickBound) {
            document.removeEventListener("click", this._onDocumentClickBound);
        }
        this._super(...arguments);
    },

    _onAddLine(event) {
        event.preventDefault();

        const rows = this.linesContainer.querySelectorAll(".so_order_line_row");
        const newRow = rows[0].cloneNode(true);

        newRow.querySelector(".so_product_id").value = "";
        newRow.querySelector(".so_product_search").value = "";
        newRow.querySelector(".so_product_suggestions_dropdown").classList.add("d-none");
        newRow.querySelector(".so_qty_input").value = 1;
        newRow.querySelector(".so_unit_price_display").value = "0.00";
        newRow.querySelectorAll(".so_tax_checkbox").forEach((checkbox) => {
            checkbox.checked = false;
        });
        newRow.querySelector(".so_tax_placeholder").classList.remove("d-none");
        newRow.querySelector(".so_tax_badges").innerHTML = "";
        newRow.querySelector(".so_discount_amount_display").value = "0.00";
        newRow.querySelector(".so_amount_display").value = "0.00";
        newRow.querySelector(".so_discount_input").value = "0.00";

        newRow.querySelector(".so_tax_search").value = "";
        newRow.querySelectorAll(".so_tax_option").forEach((option) => {
            option.classList.remove("d-none");
        });

        this.linesContainer.appendChild(newRow);
        this._toggleRemoveButtons();
        this._recalculateTotal();
    },

    _onRemoveLine(event) {
        event.preventDefault();

        const row = event.currentTarget.closest(".so_order_line_row");
        row.remove();

        this._toggleRemoveButtons();
        this._recalculateTotal();
    },

    _onProductChange(event) {
        const row = event.currentTarget.closest(".so_order_line_row");
        const selectedOption = event.currentTarget.selectedOptions[0];
        const price = parseFloat(selectedOption.dataset.price || 0);
        const taxIds = (selectedOption.dataset.taxIds || "").split(",").filter(Boolean);

        row.querySelector(".so_unit_price_display").value = price.toFixed(2);

        row.querySelectorAll(".so_tax_checkbox").forEach((checkbox) => {
            checkbox.checked = taxIds.includes(checkbox.value);
        });

        this._updateTaxDisplay(row);

        this._updateRowAmount(row);
    },

    _onQtyChange(event) {
        const row = event.currentTarget.closest(".so_order_line_row");
        this._updateRowAmount(row);
    },

    _updateRowAmount(row) {
        const price = parseFloat(row.querySelector(".so_unit_price_display").value || 0);
        const qty = parseFloat(row.querySelector(".so_qty_input").value || 0);
        const discount = parseFloat(row.querySelector(".so_discount_input").value || 0);

        const grossAmount = price * qty;
        const discountAmount = grossAmount * (discount / 100);
        const amount = grossAmount - discountAmount;

        row.querySelector(".so_discount_amount_display").value = discountAmount.toFixed(2);
        row.querySelector(".so_amount_display").value = amount.toFixed(2);

        this._recalculateTotal();
    },

    _recalculateTotal() {
        const rows = this.linesContainer.querySelectorAll(".so_order_line_row");

        let untaxedTotal = 0;
        let taxTotal = 0;

        rows.forEach((row) => {
            const amount = parseFloat(row.querySelector(".so_amount_display").value || 0);
            const taxRate = this._getRowTaxRate(row);
            const taxAmount = amount * (taxRate / 100);
            untaxedTotal += amount;
            taxTotal += taxAmount;
        });

        const globalDiscountAmount = this._getGlobalDiscountAmount(untaxedTotal);

        this.untaxedTotalEl.textContent = untaxedTotal.toFixed(2);
        this.taxTotalEl.textContent = taxTotal.toFixed(2);
        this.el.querySelector("#so_global_discount_total").textContent = globalDiscountAmount.toFixed(2);
        this.grandTotalEl.textContent = (untaxedTotal + taxTotal - globalDiscountAmount).toFixed(2);
    },

    _toggleRemoveButtons() {
        const rows = this.linesContainer.querySelectorAll(".so_order_line_row");
        const removeButtons = this.linesContainer.querySelectorAll(".so_remove_line");

        removeButtons.forEach((btn) => {
            btn.disabled = rows.length <= 1;
        });
    },
    _onUnitPriceChange(event) {
        const row = event.currentTarget.closest(".so_order_line_row");
        this._updateRowAmount(row);
    },
    _onTaxMenuClick(event) {
        event.stopPropagation();
    },

    _onTaxChange(event) {
        const row = event.currentTarget.closest(".so_order_line_row");
        this._updateTaxDisplay(row);
        this._updateRowAmount(row);
    },

    _updateTaxDisplay(row) {
        const checkedTaxes = row.querySelectorAll(".so_tax_checkbox:checked");
        const placeholder = row.querySelector(".so_tax_placeholder");
        const badges = row.querySelector(".so_tax_badges");

        badges.innerHTML = "";

        if (!checkedTaxes.length) {
            placeholder.classList.remove("d-none");
            return;
        }

        placeholder.classList.add("d-none");

        checkedTaxes.forEach((tax) => {
            const badge = document.createElement("span");
            badge.className = "so_tax_badge";
            badge.textContent = tax.dataset.name;
            badges.appendChild(badge);
        });
    },

    _getRowTaxRate(row) {
        return [...row.querySelectorAll(".so_tax_checkbox:checked")].reduce((total, tax) => {
            return total + parseFloat(tax.dataset.rate || 0);
        }, 0);
    },

    _onSubmit(event) {

        // customer search
        const customerId = this.el.querySelector("#so_customer_select").value;
        const customerSearch = this.el.querySelector("#so_customer_search");
        if (!customerId) {
            event.preventDefault();
            customerSearch.setCustomValidity("Please select a customer");
            customerSearch.reportValidity();
            return;
        }
        customerSearch.setCustomValidity("");



        const rows = this.linesContainer.querySelectorAll(".so_order_line_row");

        const lines = [...rows].map((row) => {
            return {
                product_id: parseInt(row.querySelector(".so_product_id").value || 0),
                quantity: parseFloat(row.querySelector(".so_qty_input").value || 0),
                price_unit: parseFloat(row.querySelector(".so_unit_price_display").value || 0),
                discount: parseFloat(row.querySelector(".so_discount_input").value || 0),
                tax_ids: [...row.querySelectorAll(".so_tax_checkbox:checked")].map((tax) => {
                    return parseInt(tax.value);
                }),
            };
        }).filter((line) => line.product_id && line.quantity > 0);

        this.el.querySelector("#so_order_lines_json").value = JSON.stringify(lines);
    },
    _onDiscountChange(event) {
        const row = event.currentTarget.closest(".so_order_line_row");
        this._updateRowAmount(row);
    },

    _onDiscountModeChange() {
        const mode = this.el.querySelector("input[name='so_discount_mode_choice']:checked").value;
        const suffix = this.el.querySelector("#so_discount_suffix");

        suffix.textContent = mode === "fixed" ? "Amount" : "%";
    },

    _onApplyDiscount(event) {
        event.preventDefault();

        const discountValue = parseFloat(this.el.querySelector("#so_discount_value").value || 0);
        const mode = this.el.querySelector("input[name='so_discount_mode_choice']:checked").value;

        if (mode === "line") {
            this.el.querySelector("#so_discount_mode").value = "";
            this.el.querySelector("#so_global_discount_value").value = "";
            this.el.querySelector("#so_global_discount_row").classList.add("d-none");

            this.linesContainer.querySelectorAll(".so_order_line_row").forEach((row) => {
                row.querySelector(".so_discount_input").value = discountValue.toFixed(2);
                this._updateRowAmount(row);
            });
        } else {
            this.el.querySelector("#so_discount_mode").value = mode;
            this.el.querySelector("#so_global_discount_value").value = discountValue.toFixed(2);
            this.el.querySelector("#so_global_discount_row").classList.remove("d-none");

            this._recalculateTotal();
        }

    },

    _getGlobalDiscountAmount(untaxedTotal) {
        const mode = this.el.querySelector("#so_discount_mode").value;
        const value = parseFloat(this.el.querySelector("#so_global_discount_value").value || 0);

        if (!mode || value <= 0) {
            return 0;
        }

        if (mode === "global") {
            return untaxedTotal * (value / 100);
        }

        if (mode === "fixed") {
            return Math.min(value, untaxedTotal);
        }

        return 0;
    },
    _onCustomerSearch(event) {
        const searchValue = event.currentTarget.value.toLowerCase().trim();
        const dropdown = this.el.querySelector("#so_customer_suggestions");
        const items = dropdown.querySelectorAll(".so_customer_suggestion_item");

        dropdown.classList.remove("d-none");

        items.forEach((item) => {
            const name = (item.dataset.name || "").toLowerCase();
            item.classList.toggle("d-none", !name.includes(searchValue));
        });

        this.el.querySelector("#so_customer_select").value = "";
        this._resetAddressSelects();
    },

    _onSelectCustomer(event) {
        const item = event.currentTarget;
        const customerId = item.dataset.id;
        const customerName = item.dataset.name;

        this.el.querySelector("#so_customer_select").value = customerId;
        this.el.querySelector("#so_customer_search").value = customerName;
        this.el.querySelector("#so_customer_search").setCustomValidity("");
        this.el.querySelector("#so_customer_suggestions").classList.add("d-none");

        this._loadCustomerAddresses(customerId);
    },
    async _loadCustomerAddresses(customerId) {
        if (!customerId) {
            this._resetAddressSelects();
            return;
        }

        const data = await this._jsonRpc("/sale_order/partner_addresses", {
            partner_id: parseInt(customerId),
        });

        this._fillAddressSelect(
            this.el.querySelector("#so_invoice_address"),
            data.invoice || [],
            data.default_invoice
        );

        this._fillAddressSelect(
            this.el.querySelector("#so_delivery_address"),
            data.delivery || [],
            data.default_delivery
        );
    },

    async _jsonRpc(route, params) {
        const response = await fetch(route, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                jsonrpc: "2.0",
                method: "call",
                params: params,
                id: Date.now(),
            }),
        });

        const payload = await response.json();
        return payload.result || {};
    },

    _fillAddressSelect(selectEl, addresses, defaultId) {
        selectEl.innerHTML = "";

        addresses.forEach((address) => {
            const option = document.createElement("option");
            option.value = address.id;
            option.textContent = address.name;
            option.selected = parseInt(address.id) === parseInt(defaultId);
            selectEl.appendChild(option);
        });

        selectEl.disabled = !addresses.length;
    },

    _resetAddressSelects() {
        const invoiceSelect = this.el.querySelector("#so_invoice_address");
        const deliverySelect = this.el.querySelector("#so_delivery_address");

        invoiceSelect.innerHTML = `<option value="">Select customer first</option>`;
        deliverySelect.innerHTML = `<option value="">Select customer first</option>`;

        invoiceSelect.disabled = true;
        deliverySelect.disabled = true;
    },
    _onPricelistSearch(event) {
        const searchValue = event.currentTarget.value.toLowerCase().trim();
        const dropdown = this.el.querySelector("#so_pricelist_suggestions");
        const items = dropdown.querySelectorAll(".so_pricelist_suggestion_item");

        dropdown.classList.remove("d-none");

        items.forEach((item) => {
            const name = (item.dataset.name || "").toLowerCase();
            item.classList.toggle("d-none", !name.includes(searchValue));
        });

        this.el.querySelector("#so_pricelist_id").value = "";
    },

    _onSelectPricelist(event) {
        const item = event.currentTarget;
        const pricelistId = item.dataset.id;
        const pricelistName = item.dataset.name;

        this.el.querySelector("#so_pricelist_id").value = pricelistId;
        this.el.querySelector("#so_pricelist_search").value = pricelistName;
        this.el.querySelector("#so_pricelist_suggestions").classList.add("d-none");
    },
    _onDocumentClick(event) {
        const pricelistWrapper = this.el.querySelector(".so_pricelist_search_wrapper");
        const pricelistDropdown = this.el.querySelector("#so_pricelist_suggestions");

        if (pricelistWrapper && !pricelistWrapper.contains(event.target)) {
            pricelistDropdown.classList.add("d-none");
        }

        const customerWrapper = this.el.querySelector(".so_customer_search_wrapper");
        const customerDropdown = this.el.querySelector("#so_customer_suggestions");

        if (customerWrapper && !customerWrapper.contains(event.target)) {
            customerDropdown.classList.add("d-none");
        }

        const paymentTermWrapper = this.el.querySelector(".so_payment_term_search_wrapper");
        const paymentTermDropdown = this.el.querySelector("#so_payment_term_suggestions");

        if (paymentTermWrapper && !paymentTermWrapper.contains(event.target)) {
            paymentTermDropdown.classList.add("d-none");
        }

        this.el.querySelectorAll(".so_product_search_wrapper").forEach((wrapper) => {
            const dropdown = wrapper.querySelector(".so_product_suggestions_dropdown");

            if (!wrapper.contains(event.target)) {
                dropdown.classList.add("d-none");
            }
        });
    },
    _onPaymentTermSearch(event) {
        const searchValue = event.currentTarget.value.toLowerCase().trim();
        const dropdown = this.el.querySelector("#so_payment_term_suggestions");
        const items = dropdown.querySelectorAll(".so_payment_term_suggestion_item");

        dropdown.classList.remove("d-none");

        items.forEach((item) => {
            const name = (item.dataset.name || "").toLowerCase();
            item.classList.toggle("d-none", !name.includes(searchValue));
        });

        this.el.querySelector("#so_payment_term_id").value = "";
    },

    _onSelectPaymentTerm(event) {
        const item = event.currentTarget;
        const termId = item.dataset.id;
        const termName = item.dataset.name;

        this.el.querySelector("#so_payment_term_id").value = termId;
        this.el.querySelector("#so_payment_term_search").value = termName;
        this.el.querySelector("#so_payment_term_suggestions").classList.add("d-none");
    },
    _onProductSearch(event) {
        const row = event.currentTarget.closest(".so_order_line_row");
        const searchValue = event.currentTarget.value.toLowerCase().trim();
        const dropdown = row.querySelector(".so_product_suggestions_dropdown");
        const items = dropdown.querySelectorAll(".so_product_suggestion_item");

        dropdown.classList.remove("d-none");

        items.forEach((item) => {
            const name = (item.dataset.name || "").toLowerCase();
            item.classList.toggle("d-none", !name.includes(searchValue));
        });

        row.querySelector(".so_product_id").value = "";
        row.querySelector(".so_unit_price_display").value = "0.00";
        row.querySelector(".so_discount_amount_display").value = "0.00";
        row.querySelector(".so_amount_display").value = "0.00";

        row.querySelectorAll(".so_tax_checkbox").forEach((checkbox) => {
            checkbox.checked = false;
        });

        this._updateTaxDisplay(row);
        this._updateRowAmount(row);
    },

    _onSelectProduct(event) {
        const item = event.currentTarget;
        const row = item.closest(".so_order_line_row");

        const productId = item.dataset.id;
        const productName = item.dataset.name;
        const price = parseFloat(item.dataset.price || 0);
        const taxIds = (item.dataset.taxIds || "").split(",").filter(Boolean);

        row.querySelector(".so_product_id").value = productId;
        row.querySelector(".so_product_search").value = productName;
        row.querySelector(".so_product_search").setCustomValidity("");
        row.querySelector(".so_product_suggestions_dropdown").classList.add("d-none");

        row.querySelector(".so_unit_price_display").value = price.toFixed(2);

        row.querySelectorAll(".so_tax_checkbox").forEach((checkbox) => {
            checkbox.checked = taxIds.includes(checkbox.value);
        });

        this._updateTaxDisplay(row);
        this._updateRowAmount(row);
    },
    _onTaxSearch(event) {
        const menu = event.currentTarget.closest(".so_tax_dropdown_menu");
        const searchValue = event.currentTarget.value.toLowerCase().trim();
        const options = menu.querySelectorAll(".so_tax_option");

        options.forEach((option) => {
            const name = (option.dataset.name || "").toLowerCase();
            option.classList.toggle("d-none", !name.includes(searchValue));
        });
    },
});