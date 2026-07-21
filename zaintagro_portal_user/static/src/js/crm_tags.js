/** @odoo-module **/

import publicWidget from "@web/legacy/js/public/public_widget";

publicWidget.registry.CrmOpportunityTags = publicWidget.Widget.extend({
    selector: "#crm_opportunity_form",

    events: {
        "change .crm_tag_option_input": "_onTagChange",
        "click .crm_tag_remove": "_onRemoveTag",
        "input .crm_tag_search": "_onSearchTag",
        "click .crm_tags_dropdown_menu": "_onDropdownMenuClick",
    },

    async start() {
        await this._super(...arguments);

        this.hiddenInput = this.el.querySelector("#crm_tag_ids");
        this.selectedTagsContainer = this.el.querySelector(
            ".crm_selected_tags"
        );

        this._syncTags();
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
});