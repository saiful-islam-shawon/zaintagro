/** @odoo-module **/

import publicWidget from "@web/legacy/js/public/public_widget";

async function callJsonRoute(route, params) {
    const response = await fetch(route, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            jsonrpc: "2.0",
            method: "call",
            params: params,
            id: Date.now(),
        }),
    });

    const data = await response.json();

    if (data.error) {
        throw new Error(data.error.data ? data.error.data.message : "RPC Error");
    }

    return data.result;
}

publicWidget.registry.SaleOrderCustomer = publicWidget.Widget.extend({
    selector: "#sale_order_form",

    events: {
        "change #so_customer_select": "_onCustomerChange",
        "change .so_tag_option_input": "_onSaleTagChange",
        "click .so_tag_remove": "_onRemoveSaleTag",
        "input .so_tag_search": "_onSearchSaleTag",
        "click .so_tags_dropdown_menu": "_onSaleTagDropdownMenuClick",
        "input #so_user_search": "_onSalespersonSearch",
        "focus #so_user_search": "_onSalespersonSearch",
        "click .so_user_suggestion_item": "_onSelectSalesperson",
        "input #so_team_search": "_onSalesTeamSearch",
        "focus #so_team_search": "_onSalesTeamSearch",
        "click .so_team_suggestion_item": "_onSelectSalesTeam",
        "input #so_fiscal_position_search": "_onFiscalPositionSearch",
        "focus #so_fiscal_position_search": "_onFiscalPositionSearch",
        "click .so_fiscal_position_suggestion_item": "_onSelectFiscalPosition",
        "input #so_warehouse_search": "_onWarehouseSearch",
        "focus #so_warehouse_search": "_onWarehouseSearch",
        "click .so_warehouse_suggestion_item": "_onSelectWarehouse",
        "input #so_incoterm_search": "_onIncotermSearch",
        "focus #so_incoterm_search": "_onIncotermSearch",
        "click .so_incoterm_suggestion_item": "_onSelectIncoterm",
        "input #so_opportunity_search": "_onOpportunitySearch",
        "focus #so_opportunity_search": "_onOpportunitySearch",
        "click .so_opportunity_suggestion_item": "_onSelectOpportunity",
        "input #so_campaign_search": "_onCampaignSearch",
        "focus #so_campaign_search": "_onCampaignSearch",
        "click .so_campaign_suggestion_item": "_onSelectCampaign",
        "input #so_medium_search": "_onMediumSearch",
        "focus #so_medium_search": "_onMediumSearch",
        "click .so_medium_suggestion_item": "_onSelectMedium",
        "input #so_source_search": "_onSourceSearch",
        "focus #so_source_search": "_onSourceSearch",
        "click .so_source_suggestion_item": "_onSelectSource",
    },

    async start() {
        await this._super(...arguments);

        this.invoiceSelect = this.el.querySelector("#so_invoice_address");
        this.deliverySelect = this.el.querySelector("#so_delivery_address");

        this.saleTagHiddenInput = this.el.querySelector("#so_tag_ids");
        this.saleSelectedTagsContainer = this.el.querySelector(".so_selected_tags");
        this._syncSaleTags();


        this._onDocumentClickBound = this._onDocumentClick.bind(this);
        document.addEventListener("click", this._onDocumentClickBound);
    },
    destroy() {
        if (this._onDocumentClickBound) {
            document.removeEventListener("click", this._onDocumentClickBound);
        }
        this._super(...arguments);
    },
    _onDocumentClick(event) {
        const userWrapper = this.el.querySelector(".so_user_search_wrapper");
        const userDropdown = this.el.querySelector("#so_user_suggestions");

        if (userWrapper && userDropdown && !userWrapper.contains(event.target)) {
            userDropdown.classList.add("d-none");
        }


        const teamWrapper = this.el.querySelector(".so_team_search_wrapper");
        const teamDropdown = this.el.querySelector("#so_team_suggestions");

        if (teamWrapper && teamDropdown && !teamWrapper.contains(event.target)) {
            teamDropdown.classList.add("d-none");
        }


        const fiscalPositionWrapper = this.el.querySelector(".so_fiscal_position_search_wrapper");
        const fiscalPositionDropdown = this.el.querySelector("#so_fiscal_position_suggestions");

        if (fiscalPositionWrapper && fiscalPositionDropdown && !fiscalPositionWrapper.contains(event.target)) {
            fiscalPositionDropdown.classList.add("d-none");
        }


        const warehouseWrapper = this.el.querySelector(".so_warehouse_search_wrapper");
        const warehouseDropdown = this.el.querySelector("#so_warehouse_suggestions");

        if (warehouseWrapper && warehouseDropdown && !warehouseWrapper.contains(event.target)) {
            warehouseDropdown.classList.add("d-none");
        }


        const incotermWrapper = this.el.querySelector(".so_incoterm_search_wrapper");
        const incotermDropdown = this.el.querySelector("#so_incoterm_suggestions");

        if (incotermWrapper && incotermDropdown && !incotermWrapper.contains(event.target)) {
            incotermDropdown.classList.add("d-none");
        }



        const opportunityWrapper = this.el.querySelector(".so_opportunity_search_wrapper");
        const opportunityDropdown = this.el.querySelector("#so_opportunity_suggestions");

        if (opportunityWrapper && opportunityDropdown && !opportunityWrapper.contains(event.target)) {
            opportunityDropdown.classList.add("d-none");
        }



        const campaignWrapper = this.el.querySelector(".so_campaign_search_wrapper");
        const campaignDropdown = this.el.querySelector("#so_campaign_suggestions");

        if (campaignWrapper && campaignDropdown && !campaignWrapper.contains(event.target)) {
            campaignDropdown.classList.add("d-none");
        }



        const mediumWrapper = this.el.querySelector(".so_medium_search_wrapper");
        const mediumDropdown = this.el.querySelector("#so_medium_suggestions");

        if (mediumWrapper && mediumDropdown && !mediumWrapper.contains(event.target)) {
            mediumDropdown.classList.add("d-none");
        }


        const sourceWrapper = this.el.querySelector(".so_source_search_wrapper");
        const sourceDropdown = this.el.querySelector("#so_source_suggestions");

        if (sourceWrapper && sourceDropdown && !sourceWrapper.contains(event.target)) {
            sourceDropdown.classList.add("d-none");
        }
    },

    async _onCustomerChange(event) {
        const partnerId = event.currentTarget.value;

        if (!partnerId) {
            this._resetAddressSelect(this.invoiceSelect);
            this._resetAddressSelect(this.deliverySelect);
            return;
        }

        try {
            const result = await callJsonRoute("/sale_order/partner_addresses", {
                partner_id: partnerId,
            });

            this._populateAddressSelect(this.invoiceSelect, result.invoice, result.default_invoice);
            this._populateAddressSelect(this.deliverySelect, result.delivery, result.default_delivery);
        } catch (error) {
            console.error("Failed to load addresses:", error);
        }
    },

    _resetAddressSelect(selectEl) {
        selectEl.replaceChildren();

        const option = document.createElement("option");
        option.textContent = "Select customer first";
        selectEl.appendChild(option);
        selectEl.disabled = true;
    },

    _populateAddressSelect(selectEl, options, defaultId) {
        selectEl.replaceChildren();
        selectEl.disabled = false;

        options.forEach((option) => {
            const opt = document.createElement("option");
            opt.value = option.id;
            opt.textContent = option.name;
            selectEl.appendChild(opt);
        });

        if (defaultId) {
            selectEl.value = String(defaultId);
        }
    },
    _onSaleTagDropdownMenuClick(event) {
        event.stopPropagation();
    },

    _onSaleTagChange() {
        this._syncSaleTags();
    },

    _onRemoveSaleTag(event) {
        event.preventDefault();
        event.stopPropagation();

        const tagId = event.currentTarget.dataset.tagId;
        const checkbox = this.el.querySelector(`.so_tag_option_input[value="${tagId}"]`);

        if (checkbox) {
            checkbox.checked = false;
        }

        this._syncSaleTags();
    },

    _onSearchSaleTag(event) {
        const searchValue = event.currentTarget.value.trim().toLowerCase();
        const tagOptions = this.el.querySelectorAll(".so_tag_option");

        tagOptions.forEach((option) => {
            const tagName = option.dataset.tagName || "";
            option.classList.toggle("d-none", !tagName.includes(searchValue));
        });
    },

    _syncSaleTags() {
        if (!this.saleTagHiddenInput || !this.saleSelectedTagsContainer) {
            return;
        }

        const selectedCheckboxes = Array.from(
            this.el.querySelectorAll(".so_tag_option_input:checked")
        );

        const selectedTagIds = selectedCheckboxes.map((checkbox) => checkbox.value);

        this.saleTagHiddenInput.value = selectedTagIds.join(",");

        this._renderSaleTags(selectedCheckboxes);
    },

    _renderSaleTags(selectedCheckboxes) {
        this.saleSelectedTagsContainer.replaceChildren();

        if (!selectedCheckboxes.length) {
            const placeholder = document.createElement("span");
            placeholder.className = "so_tag_placeholder";
            placeholder.textContent = "Select tags...";
            this.saleSelectedTagsContainer.appendChild(placeholder);
            return;
        }

        selectedCheckboxes.forEach((checkbox) => {
            const tagChip = document.createElement("span");
            tagChip.className = "so_selected_tag";

            const tagName = document.createElement("span");
            tagName.textContent = checkbox.dataset.tagName || "Unnamed Tag";

            const removeIcon = document.createElement("span");
            removeIcon.className = "so_tag_remove";
            removeIcon.dataset.tagId = checkbox.value;
            removeIcon.setAttribute("role", "button");
            removeIcon.textContent = "×";

            tagChip.appendChild(tagName);
            tagChip.appendChild(removeIcon);

            this.saleSelectedTagsContainer.appendChild(tagChip);
        });
    },
    _onSalespersonSearch(event) {
        const searchValue = event.currentTarget.value.toLowerCase().trim();
        const dropdown = this.el.querySelector("#so_user_suggestions");
        const items = dropdown.querySelectorAll(".so_user_suggestion_item");

        dropdown.classList.remove("d-none");

        items.forEach((item) => {
            const name = (item.dataset.name || "").toLowerCase();
            item.classList.toggle("d-none", !name.includes(searchValue));
        });

        this.el.querySelector("#so_user_id").value = "";
    },

    _onSelectSalesperson(event) {
        const item = event.currentTarget;

        this.el.querySelector("#so_user_id").value = item.dataset.id;
        this.el.querySelector("#so_user_search").value = item.dataset.name;
        this.el.querySelector("#so_user_suggestions").classList.add("d-none");
    },
    _onSalesTeamSearch(event) {
        const searchValue = event.currentTarget.value.toLowerCase().trim();
        const dropdown = this.el.querySelector("#so_team_suggestions");
        const items = dropdown.querySelectorAll(".so_team_suggestion_item");

        dropdown.classList.remove("d-none");

        items.forEach((item) => {
            const name = (item.dataset.name || "").toLowerCase();
            item.classList.toggle("d-none", !name.includes(searchValue));
        });

        this.el.querySelector("#so_team_id").value = "";
    },

    _onSelectSalesTeam(event) {
        const item = event.currentTarget;

        this.el.querySelector("#so_team_id").value = item.dataset.id;
        this.el.querySelector("#so_team_search").value = item.dataset.name;
        this.el.querySelector("#so_team_suggestions").classList.add("d-none");
    },
    _onFiscalPositionSearch(event) {
        const searchValue = event.currentTarget.value.toLowerCase().trim();
        const dropdown = this.el.querySelector("#so_fiscal_position_suggestions");
        const items = dropdown.querySelectorAll(".so_fiscal_position_suggestion_item");

        dropdown.classList.remove("d-none");

        items.forEach((item) => {
            const name = (item.dataset.name || "").toLowerCase();
            item.classList.toggle("d-none", !name.includes(searchValue));
        });

        this.el.querySelector("#so_fiscal_position_id").value = "";
    },

    _onSelectFiscalPosition(event) {
        const item = event.currentTarget;

        this.el.querySelector("#so_fiscal_position_id").value = item.dataset.id;
        this.el.querySelector("#so_fiscal_position_search").value = item.dataset.name;
        this.el.querySelector("#so_fiscal_position_suggestions").classList.add("d-none");
    },
    _onWarehouseSearch(event) {
        const searchValue = event.currentTarget.value.toLowerCase().trim();
        const dropdown = this.el.querySelector("#so_warehouse_suggestions");
        const items = dropdown.querySelectorAll(".so_warehouse_suggestion_item");

        dropdown.classList.remove("d-none");

        items.forEach((item) => {
            const name = (item.dataset.name || "").toLowerCase();
            item.classList.toggle("d-none", !name.includes(searchValue));
        });

        this.el.querySelector("#so_warehouse_id").value = "";
    },

    _onSelectWarehouse(event) {
        const item = event.currentTarget;

        this.el.querySelector("#so_warehouse_id").value = item.dataset.id;
        this.el.querySelector("#so_warehouse_search").value = item.dataset.name;
        this.el.querySelector("#so_warehouse_suggestions").classList.add("d-none");
    },
    _onIncotermSearch(event) {
        const searchValue = event.currentTarget.value.toLowerCase().trim();
        const dropdown = this.el.querySelector("#so_incoterm_suggestions");
        const items = dropdown.querySelectorAll(".so_incoterm_suggestion_item");

        dropdown.classList.remove("d-none");

        items.forEach((item) => {
            const name = (item.dataset.name || "").toLowerCase();
            item.classList.toggle("d-none", !name.includes(searchValue));
        });

        this.el.querySelector("#so_incoterm").value = "";
    },

    _onSelectIncoterm(event) {
        const item = event.currentTarget;

        this.el.querySelector("#so_incoterm").value = item.dataset.id;
        this.el.querySelector("#so_incoterm_search").value = item.dataset.name;
        this.el.querySelector("#so_incoterm_suggestions").classList.add("d-none");
    },
    _onOpportunitySearch(event) {
        const searchValue = event.currentTarget.value.toLowerCase().trim();
        const dropdown = this.el.querySelector("#so_opportunity_suggestions");
        const items = dropdown.querySelectorAll(".so_opportunity_suggestion_item");

        dropdown.classList.remove("d-none");

        items.forEach((item) => {
            const name = (item.dataset.name || "").toLowerCase();
            item.classList.toggle("d-none", !name.includes(searchValue));
        });

        this.el.querySelector("#so_opportunity_id").value = "";
    },

    _onSelectOpportunity(event) {
        const item = event.currentTarget;

        this.el.querySelector("#so_opportunity_id").value = item.dataset.id;
        this.el.querySelector("#so_opportunity_search").value = item.dataset.name;
        this.el.querySelector("#so_opportunity_suggestions").classList.add("d-none");
    },
    _onCampaignSearch(event) {
        const searchValue = event.currentTarget.value.toLowerCase().trim();
        const dropdown = this.el.querySelector("#so_campaign_suggestions");
        const items = dropdown.querySelectorAll(".so_campaign_suggestion_item");

        dropdown.classList.remove("d-none");

        items.forEach((item) => {
            const name = (item.dataset.name || "").toLowerCase();
            item.classList.toggle("d-none", !name.includes(searchValue));
        });

        this.el.querySelector("#so_campaign_id").value = "";
    },

    _onSelectCampaign(event) {
        const item = event.currentTarget;

        this.el.querySelector("#so_campaign_id").value = item.dataset.id;
        this.el.querySelector("#so_campaign_search").value = item.dataset.name;
        this.el.querySelector("#so_campaign_suggestions").classList.add("d-none");
    },
    _onMediumSearch(event) {
        const searchValue = event.currentTarget.value.toLowerCase().trim();
        const dropdown = this.el.querySelector("#so_medium_suggestions");
        const items = dropdown.querySelectorAll(".so_medium_suggestion_item");

        dropdown.classList.remove("d-none");

        items.forEach((item) => {
            const name = (item.dataset.name || "").toLowerCase();
            item.classList.toggle("d-none", !name.includes(searchValue));
        });

        this.el.querySelector("#so_medium_id").value = "";
    },

    _onSelectMedium(event) {
        const item = event.currentTarget;

        this.el.querySelector("#so_medium_id").value = item.dataset.id;
        this.el.querySelector("#so_medium_search").value = item.dataset.name;
        this.el.querySelector("#so_medium_suggestions").classList.add("d-none");
    },
    _onSourceSearch(event) {
        const searchValue = event.currentTarget.value.toLowerCase().trim();
        const dropdown = this.el.querySelector("#so_source_suggestions");
        const items = dropdown.querySelectorAll(".so_source_suggestion_item");

        dropdown.classList.remove("d-none");

        items.forEach((item) => {
            const name = (item.dataset.name || "").toLowerCase();
            item.classList.toggle("d-none", !name.includes(searchValue));
        });

        this.el.querySelector("#so_source_id").value = "";
    },

    _onSelectSource(event) {
        const item = event.currentTarget;

        this.el.querySelector("#so_source_id").value = item.dataset.id;
        this.el.querySelector("#so_source_search").value = item.dataset.name;
        this.el.querySelector("#so_source_suggestions").classList.add("d-none");
    },
});