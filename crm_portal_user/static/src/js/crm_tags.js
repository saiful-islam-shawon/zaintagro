/** @odoo-module **/

import publicWidget from "@web/legacy/js/public/public_widget";

publicWidget.registry.CrmOpportunityTags = publicWidget.Widget.extend({
    selector: "#crm_opportunity_form",

    events: {
        "change .crm_tag_option_input": "_onTagChange",
        "click .crm_tag_remove": "_onRemoveTag",
        "input .crm_tag_search": "_onSearchTag",
        "click .crm_tags_dropdown_menu": "_onDropdownMenuClick",
        "input #crm_state_search": "_onStateSearch",
        "focus #crm_state_search": "_onStateSearch",
        "click .crm_state_suggestion_item": "_onSelectState",
        "input #crm_campaign_search": "_onCampaignSearch",
        "focus #crm_campaign_search": "_onCampaignSearch",
        "click .crm_campaign_suggestion_item": "_onSelectCampaign",
        "input #crm_medium_search": "_onMediumSearch",
        "focus #crm_medium_search": "_onMediumSearch",
        "click .crm_medium_suggestion_item": "_onSelectMedium",
        "input #crm_source_search": "_onSourceSearch",
        "focus #crm_source_search": "_onSourceSearch",
        "click .crm_source_suggestion_item": "_onSelectSource",
        "input #crm_country_search": "_onCountrySearch",
        "focus #crm_country_search": "_onCountrySearch",
        "click .crm_country_suggestion_item": "_onSelectCountry",
    },

    async start() {
        await this._super(...arguments);

        this.hiddenInput = this.el.querySelector("#crm_tag_ids");
        this.selectedTagsContainer = this.el.querySelector(
            ".crm_selected_tags"
        );

        this._syncTags();

        this._onDocumentClickBound = this._onDocumentClick.bind(this);
        document.addEventListener("click", this._onDocumentClickBound);
    },
    destroy() {
        if (this._onDocumentClickBound) {
            document.removeEventListener("click", this._onDocumentClickBound);
        }
        this._super(...arguments);
    },

    /**
     * Prevent dropdown from closing while selecting tags.
     */
    _onDropdownMenuClick(event) {
        event.stopPropagation();
    },

    /**
     * Runs whenever a tag checkbox changes.
     */
    _onTagChange() {
        this._syncTags();
    },

    /**
     * Remove selected tag from chip close icon.
     */
    _onRemoveTag(event) {
        event.preventDefault();
        event.stopPropagation();

        const tagId = event.currentTarget.dataset.tagId;

        const checkbox = this.el.querySelector(
            `.crm_tag_option_input[value="${tagId}"]`
        );

        if (checkbox) {
            checkbox.checked = false;
        }

        this._syncTags();
    },

    /**
     * Search/filter tags inside dropdown.
     */
    _onSearchTag(event) {
        const searchValue = event.currentTarget.value
            .trim()
            .toLowerCase();

        const tagOptions = this.el.querySelectorAll(
            ".crm_tag_option"
        );

        tagOptions.forEach((option) => {
            const tagName = option.dataset.tagName || "";

            option.classList.toggle(
                "d-none",
                !tagName.includes(searchValue)
            );
        });
    },

    /**
     * Save selected IDs and redraw selected chips.
     */
    _syncTags() {
        if (!this.hiddenInput || !this.selectedTagsContainer) {
            return;
        }

        const selectedCheckboxes = Array.from(
            this.el.querySelectorAll(
                ".crm_tag_option_input:checked"
            )
        );

        const selectedTagIds = selectedCheckboxes.map(
            (checkbox) => checkbox.value
        );

        // Odoo Website Form receives: "2,5,8"
        this.hiddenInput.value = selectedTagIds.join(",");

        this._renderSelectedTags(selectedCheckboxes);
    },

    /**
     * Render selected tags like Odoo many2many_tags widget.
     */
    _renderSelectedTags(selectedCheckboxes) {
        this.selectedTagsContainer.replaceChildren();

        if (!selectedCheckboxes.length) {
            const placeholder = document.createElement("span");

            placeholder.className = "crm_tag_placeholder";
            placeholder.textContent = "Select tags...";

            this.selectedTagsContainer.appendChild(placeholder);
            return;
        }

        selectedCheckboxes.forEach((checkbox) => {
            const tagChip = document.createElement("span");
            tagChip.className = "crm_selected_tag";

            const tagName = document.createElement("span");
            tagName.textContent =
                checkbox.dataset.tagName || "Unnamed Tag";

            const removeIcon = document.createElement("span");
            removeIcon.className = "crm_tag_remove";
            removeIcon.dataset.tagId = checkbox.value;
            removeIcon.setAttribute("role", "button");
            removeIcon.setAttribute(
                "aria-label",
                `Remove ${checkbox.dataset.tagName || "tag"}`
            );
            removeIcon.textContent = "×";

            tagChip.appendChild(tagName);
            tagChip.appendChild(removeIcon);

            this.selectedTagsContainer.appendChild(tagChip);
        });
    },
    _onStateSearch(event) {
        const searchValue = event.currentTarget.value.toLowerCase().trim();
        const selectedCountryId = this.el.querySelector("#crm_country_id").value;
        const dropdown = this.el.querySelector("#crm_state_suggestions");
        const items = dropdown.querySelectorAll(".crm_state_suggestion_item");

        dropdown.classList.remove("d-none");

        items.forEach((item) => {
            const name = (item.dataset.name || "").toLowerCase();
            const countryId = item.dataset.countryId || "";
            const matchesName = name.includes(searchValue);
            const matchesCountry = !selectedCountryId || countryId === selectedCountryId;

            item.classList.toggle("d-none", !(matchesName && matchesCountry));
        });

        this.el.querySelector("#crm_state_id").value = "";
    },

    _onSelectState(event) {
        const item = event.currentTarget;
        const stateId = item.dataset.id;
        const stateName = item.dataset.name;

        this.el.querySelector("#crm_state_id").value = stateId;
        this.el.querySelector("#crm_state_search").value = stateName;
        this.el.querySelector("#crm_state_suggestions").classList.add("d-none");
    },

    _onCountryChange() {
        this._resetState();
    },

    _onDocumentClick(event) {
        const stateWrapper = this.el.querySelector(".crm_state_search_wrapper");
        const stateDropdown = this.el.querySelector("#crm_state_suggestions");

        if (stateWrapper && !stateWrapper.contains(event.target)) {
            stateDropdown.classList.add("d-none");
        }


        const campaignWrapper = this.el.querySelector(".crm_campaign_search_wrapper");
        const campaignDropdown = this.el.querySelector("#crm_campaign_suggestions");

        if (campaignWrapper && !campaignWrapper.contains(event.target)) {
            campaignDropdown.classList.add("d-none");
        }


        const mediumWrapper = this.el.querySelector(".crm_medium_search_wrapper");
        const mediumDropdown = this.el.querySelector("#crm_medium_suggestions");

        if (mediumWrapper && !mediumWrapper.contains(event.target)) {
            mediumDropdown.classList.add("d-none");
        }


        const sourceWrapper = this.el.querySelector(".crm_source_search_wrapper");
        const sourceDropdown = this.el.querySelector("#crm_source_suggestions");

        if (sourceWrapper && !sourceWrapper.contains(event.target)) {
            sourceDropdown.classList.add("d-none");
        }


        const countryWrapper = this.el.querySelector(".crm_country_search_wrapper");
        const countryDropdown = this.el.querySelector("#crm_country_suggestions");

        if (countryWrapper && !countryWrapper.contains(event.target)) {
            countryDropdown.classList.add("d-none");
        }
    },
    _onCampaignSearch(event) {
        const searchValue = event.currentTarget.value.toLowerCase().trim();
        const dropdown = this.el.querySelector("#crm_campaign_suggestions");
        const items = dropdown.querySelectorAll(".crm_campaign_suggestion_item");

        dropdown.classList.remove("d-none");

        items.forEach((item) => {
            const name = (item.dataset.name || "").toLowerCase();
            item.classList.toggle("d-none", !name.includes(searchValue));
        });

        this.el.querySelector("#crm_campaign_id").value = "";
    },

    _onSelectCampaign(event) {
        const item = event.currentTarget;
        const campaignId = item.dataset.id;
        const campaignName = item.dataset.name;

        this.el.querySelector("#crm_campaign_id").value = campaignId;
        this.el.querySelector("#crm_campaign_search").value = campaignName;
        this.el.querySelector("#crm_campaign_suggestions").classList.add("d-none");
    },
    _onMediumSearch(event) {
        const searchValue = event.currentTarget.value.toLowerCase().trim();
        const dropdown = this.el.querySelector("#crm_medium_suggestions");
        const items = dropdown.querySelectorAll(".crm_medium_suggestion_item");

        dropdown.classList.remove("d-none");

        items.forEach((item) => {
            const name = (item.dataset.name || "").toLowerCase();
            item.classList.toggle("d-none", !name.includes(searchValue));
        });

        this.el.querySelector("#crm_medium_id").value = "";
    },

    _onSelectMedium(event) {
        const item = event.currentTarget;
        const mediumId = item.dataset.id;
        const mediumName = item.dataset.name;

        this.el.querySelector("#crm_medium_id").value = mediumId;
        this.el.querySelector("#crm_medium_search").value = mediumName;
        this.el.querySelector("#crm_medium_suggestions").classList.add("d-none");
    },
    _onSourceSearch(event) {
        const searchValue = event.currentTarget.value.toLowerCase().trim();
        const dropdown = this.el.querySelector("#crm_source_suggestions");
        const items = dropdown.querySelectorAll(".crm_source_suggestion_item");

        dropdown.classList.remove("d-none");

        items.forEach((item) => {
            const name = (item.dataset.name || "").toLowerCase();
            item.classList.toggle("d-none", !name.includes(searchValue));
        });

        this.el.querySelector("#crm_source_id").value = "";
    },

    _onSelectSource(event) {
        const item = event.currentTarget;
        const sourceId = item.dataset.id;
        const sourceName = item.dataset.name;

        this.el.querySelector("#crm_source_id").value = sourceId;
        this.el.querySelector("#crm_source_search").value = sourceName;
        this.el.querySelector("#crm_source_suggestions").classList.add("d-none");
    },
    _onCountrySearch(event) {
        const searchValue = event.currentTarget.value.toLowerCase().trim();
        const dropdown = this.el.querySelector("#crm_country_suggestions");
        const items = dropdown.querySelectorAll(".crm_country_suggestion_item");

        dropdown.classList.remove("d-none");

        items.forEach((item) => {
            const name = (item.dataset.name || "").toLowerCase();
            item.classList.toggle("d-none", !name.includes(searchValue));
        });

        this.el.querySelector("#crm_country_id").value = "";
        this._resetState();
    },

    _onSelectCountry(event) {
        const item = event.currentTarget;
        const countryId = item.dataset.id;
        const countryName = item.dataset.name;

        this.el.querySelector("#crm_country_id").value = countryId;
        this.el.querySelector("#crm_country_search").value = countryName;
        this.el.querySelector("#crm_country_suggestions").classList.add("d-none");

        this._resetState();
    },

    _resetState() {
        this.el.querySelector("#crm_state_id").value = "";
        this.el.querySelector("#crm_state_search").value = "";
        this.el.querySelector("#crm_state_suggestions").classList.add("d-none");
    },
});