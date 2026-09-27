/** @odoo-module **/

import publicWidget from "@web/legacy/js/public/public_widget";


// ============================================================================
// FAKIR PORTAL CRM
// OPPORTUNITY LIST
// ============================================================================

publicWidget.registry.FakirPortalCrmOpportunityList =
    publicWidget.Widget.extend({

        // =====================================================
        // WIDGET ROOT
        // =====================================================

        selector: "#fpmCrmOpportunityList",

        // =====================================================
        // WIDGET EVENTS
        //
        // NOTE:
        // Optional-column checkbox change is NOT handled here.
        // The dropdown is moved to <body> while open, so those
        // checkbox events are bound directly in start().
        // =====================================================

        events: {
            "click #fpmCrmOptionalColumnsButton":
                "_onSettingsButtonClick",

            "change #fpmCrmSelectAll":
                "_onSelectAll",

            "click .fpm-crm-row-checkbox":
                "_onRowCheckboxClick",

            "change .fpm-crm-row-checkbox":
                "_onRowCheckboxChange",

            "click .fpm-crm-opportunity-row":
                "_onOpportunityRowClick",
        },

        // =====================================================
        // START
        // =====================================================

        start() {

            // -------------------------------------------------
            // Local Storage
            // -------------------------------------------------

            this.storageKey =
                "crm_portal.portal_crm.optional_columns.v1";


            // -------------------------------------------------
            // Default visible optional columns
            // -------------------------------------------------

            this.defaultColumns = [
                "contact_name",
                "salesperson",
                "expected_revenue",
                "stage",
            ];


            // -------------------------------------------------
            // Main elements
            // -------------------------------------------------

            this.settingsButton =
                this.el.querySelector(
                    "#fpmCrmOptionalColumnsButton"
                );

            this.optionalMenu =
                this.el.querySelector(
                    ".fpm-crm-optional-menu"
                );

            this.dropdownWrapper =
                this.settingsButton
                    ? this.settingsButton.closest(".dropdown")
                    : null;


            // -------------------------------------------------
            // Remember original dropdown location
            // -------------------------------------------------

            this.menuOriginalParent =
                this.optionalMenu
                    ? this.optionalMenu.parentNode
                    : null;

            this.menuOriginalNextSibling =
                this.optionalMenu
                    ? this.optionalMenu.nextSibling
                    : null;


            // -------------------------------------------------
            // Dropdown state
            // -------------------------------------------------

            this.isOptionalMenuOpen = false;


            // -------------------------------------------------
            // Direct checkbox listener
            //
            // IMPORTANT:
            // Dropdown moves to document.body when open.
            // publicWidget delegated events cannot catch events
            // outside this.el, so we bind directly to the menu.
            // -------------------------------------------------

            this._columnChangeHandler =
                this._onFloatingColumnChange.bind(this);

            if (this.optionalMenu) {
                this.optionalMenu.addEventListener(
                    "change",
                    this._columnChangeHandler
                );
            }


            // -------------------------------------------------
            // Document click
            // -------------------------------------------------

            this._documentClickHandler =
                this._onDocumentClick.bind(this);

            document.addEventListener(
                "click",
                this._documentClickHandler
            );


            // -------------------------------------------------
            // Window resize
            // -------------------------------------------------

            this._windowResizeHandler =
                this._onWindowResize.bind(this);

            window.addEventListener(
                "resize",
                this._windowResizeHandler
            );


            // -------------------------------------------------
            // Window/page/table scroll
            // -------------------------------------------------

            this._windowScrollHandler =
                this._onWindowScroll.bind(this);

            window.addEventListener(
                "scroll",
                this._windowScrollHandler,
                true
            );


            // -------------------------------------------------
            // Initialize functionality
            // -------------------------------------------------

            this._initializeOptionalColumns();

            this._updateSelectAllState();


            return this._super(...arguments);
        },

        // =====================================================
        // DESTROY
        // =====================================================

        destroy() {

            // Remove optional column listener.
            if (
                this.optionalMenu &&
                this._columnChangeHandler
            ) {
                this.optionalMenu.removeEventListener(
                    "change",
                    this._columnChangeHandler
                );
            }


            // Remove document listener.
            if (this._documentClickHandler) {
                document.removeEventListener(
                    "click",
                    this._documentClickHandler
                );
            }


            // Remove resize listener.
            if (this._windowResizeHandler) {
                window.removeEventListener(
                    "resize",
                    this._windowResizeHandler
                );
            }


            // Remove scroll listener.
            if (this._windowScrollHandler) {
                window.removeEventListener(
                    "scroll",
                    this._windowScrollHandler,
                    true
                );
            }


            // Restore menu before widget destruction.
            this._restoreOptionalMenu();


            return this._super(...arguments);
        },

        // =====================================================
        // SETTINGS BUTTON
        // =====================================================

        _onSettingsButtonClick(ev) {
            ev.preventDefault();
            ev.stopPropagation();

            if (this.isOptionalMenuOpen) {
                this._closeOptionalMenu();
            } else {
                this._openOptionalMenu();
            }
        },

        // =====================================================
        // OPEN OPTIONAL MENU
        // =====================================================

        _openOptionalMenu() {

            if (
                !this.optionalMenu ||
                !this.settingsButton
            ) {
                return;
            }

            this.isOptionalMenuOpen = true;


            // -------------------------------------------------
            // Move dropdown to body.
            //
            // This prevents table overflow-x:auto
            // from clipping the dropdown.
            // -------------------------------------------------

            if (
                this.optionalMenu.parentNode !==
                document.body
            ) {
                document.body.appendChild(
                    this.optionalMenu
                );
            }


            // -------------------------------------------------
            // Add open/floating classes
            // -------------------------------------------------

            this.optionalMenu.classList.add(
                "show"
            );

            this.optionalMenu.classList.add(
                "fpm-crm-floating-optional-menu"
            );


            // -------------------------------------------------
            // Accessibility
            // -------------------------------------------------

            this.settingsButton.setAttribute(
                "aria-expanded",
                "true"
            );


            // -------------------------------------------------
            // Position dropdown
            // -------------------------------------------------

            this._positionOptionalMenu();
        },

        // =====================================================
        // CLOSE OPTIONAL MENU
        // =====================================================

        _closeOptionalMenu() {

            if (!this.optionalMenu) {
                return;
            }

            this.isOptionalMenuOpen = false;


            // -------------------------------------------------
            // Remove open/floating classes
            // -------------------------------------------------

            this.optionalMenu.classList.remove(
                "show"
            );

            this.optionalMenu.classList.remove(
                "fpm-crm-floating-optional-menu"
            );


            // -------------------------------------------------
            // Remove dynamic positioning
            // -------------------------------------------------

            this.optionalMenu.removeAttribute(
                "style"
            );


            // -------------------------------------------------
            // Accessibility
            // -------------------------------------------------

            if (this.settingsButton) {
                this.settingsButton.setAttribute(
                    "aria-expanded",
                    "false"
                );
            }


            // -------------------------------------------------
            // Put dropdown back into original XML position
            // -------------------------------------------------

            this._restoreOptionalMenu();
        },

        // =====================================================
        // RESTORE OPTIONAL MENU
        // =====================================================

        _restoreOptionalMenu() {

            if (
                !this.optionalMenu ||
                !this.menuOriginalParent
            ) {
                return;
            }


            // Already restored.
            if (
                this.optionalMenu.parentNode ===
                this.menuOriginalParent
            ) {
                return;
            }


            // Restore at exact original location if possible.
            if (
                this.menuOriginalNextSibling &&
                this.menuOriginalNextSibling.parentNode ===
                    this.menuOriginalParent
            ) {
                this.menuOriginalParent.insertBefore(
                    this.optionalMenu,
                    this.menuOriginalNextSibling
                );

                return;
            }


            // Fallback.
            this.menuOriginalParent.appendChild(
                this.optionalMenu
            );
        },

        // =====================================================
        // POSITION FLOATING MENU
        // =====================================================

        _positionOptionalMenu() {

            if (
                !this.isOptionalMenuOpen ||
                !this.settingsButton ||
                !this.optionalMenu
            ) {
                return;
            }


            const buttonRect =
                this.settingsButton.getBoundingClientRect();


            // -------------------------------------------------
            // Configuration
            // -------------------------------------------------

            const spacing = 6;

            const menuWidth = 260;

            const preferredMaxHeight = 520;


            const viewportWidth =
                document.documentElement.clientWidth;

            const viewportHeight =
                document.documentElement.clientHeight;


            // =================================================
            // HORIZONTAL POSITION
            // =================================================

            // Align menu right edge with button right edge.
            let left =
                buttonRect.right -
                menuWidth;


            // Prevent menu from going outside left side.
            if (left < spacing) {
                left = spacing;
            }


            // Prevent menu from going outside right side.
            if (
                left + menuWidth >
                viewportWidth - spacing
            ) {
                left =
                    viewportWidth -
                    menuWidth -
                    spacing;
            }


            // =================================================
            // AVAILABLE SPACE
            // =================================================

            const availableBelow =
                viewportHeight -
                buttonRect.bottom -
                spacing;

            const availableAbove =
                buttonRect.top -
                spacing;


            let top;
            let maxHeight;


            // =================================================
            // OPEN ABOVE
            // =================================================

            if (
                availableBelow < 250 &&
                availableAbove > availableBelow
            ) {

                maxHeight =
                    Math.min(
                        preferredMaxHeight,
                        availableAbove
                    );


                // Temporarily position for height calculation.
                this.optionalMenu.style.visibility =
                    "hidden";

                this.optionalMenu.style.position =
                    "fixed";

                this.optionalMenu.style.left =
                    `${left}px`;

                this.optionalMenu.style.top =
                    "0px";

                this.optionalMenu.style.width =
                    `${menuWidth}px`;

                this.optionalMenu.style.maxHeight =
                    `${maxHeight}px`;

                this.optionalMenu.style.overflowY =
                    "auto";


                const menuHeight =
                    this.optionalMenu.offsetHeight;


                top =
                    buttonRect.top -
                    menuHeight -
                    spacing;


                this.optionalMenu.style.visibility =
                    "";
            }

            // =================================================
            // OPEN BELOW
            // =================================================

            else {

                top =
                    buttonRect.bottom +
                    spacing;

                maxHeight =
                    Math.min(
                        preferredMaxHeight,
                        availableBelow
                    );
            }


            // -------------------------------------------------
            // Safety
            // -------------------------------------------------

            if (top < spacing) {
                top = spacing;
            }


            maxHeight =
                Math.max(
                    maxHeight,
                    150
                );


            // =================================================
            // APPLY FINAL POSITION
            // =================================================

            this.optionalMenu.style.position =
                "fixed";

            this.optionalMenu.style.left =
                `${left}px`;

            this.optionalMenu.style.top =
                `${top}px`;

            this.optionalMenu.style.right =
                "auto";

            this.optionalMenu.style.bottom =
                "auto";

            this.optionalMenu.style.width =
                `${menuWidth}px`;

            this.optionalMenu.style.maxHeight =
                `${maxHeight}px`;

            this.optionalMenu.style.overflowX =
                "hidden";

            this.optionalMenu.style.overflowY =
                "auto";

            this.optionalMenu.style.zIndex =
                "2000";
        },

        // =====================================================
        // DOCUMENT CLICK
        // =====================================================

        _onDocumentClick(ev) {

            if (!this.isOptionalMenuOpen) {
                return;
            }


            const clickedButton =
                this.settingsButton &&
                this.settingsButton.contains(
                    ev.target
                );


            const clickedMenu =
                this.optionalMenu &&
                this.optionalMenu.contains(
                    ev.target
                );


            // Click inside button/menu:
            // do nothing.
            if (
                clickedButton ||
                clickedMenu
            ) {
                return;
            }


            // Click outside:
            // close menu.
            this._closeOptionalMenu();
        },

        // =====================================================
        // RESIZE
        // =====================================================

        _onWindowResize() {

            if (!this.isOptionalMenuOpen) {
                return;
            }

            this._positionOptionalMenu();
        },

        // =====================================================
        // SCROLL
        // =====================================================

        _onWindowScroll() {

            if (!this.isOptionalMenuOpen) {
                return;
            }

            this._positionOptionalMenu();
        },

        // =====================================================
        // OPTIONAL COLUMNS INITIALIZATION
        // =====================================================

        _initializeOptionalColumns() {

            const selectedColumns =
                this._loadSelectedColumns();

            this._applyColumnState(
                selectedColumns
            );
        },

        // =====================================================
        // GET COLUMN CHECKBOXES
        // =====================================================

        _getColumnToggles() {

            if (!this.optionalMenu) {
                return [];
            }

            /**
             * Search inside optionalMenu itself.
             *
             * This works whether menu is:
             *
             * 1. Inside widget root
             * 2. Moved to document.body
             */

            return Array.from(
                this.optionalMenu.querySelectorAll(
                    ".fpm-crm-column-toggle"
                )
            );
        },

        // =====================================================
        // AVAILABLE COLUMNS
        // =====================================================

        _getAvailableColumns() {

            return this._getColumnToggles()
                .map(
                    (toggle) =>
                        toggle.value
                )
                .filter(Boolean);
        },

        // =====================================================
        // DEFAULT COLUMNS
        // =====================================================

        _getDefaultColumns() {

            const availableColumns =
                new Set(
                    this._getAvailableColumns()
                );

            return this.defaultColumns.filter(
                (columnName) =>
                    availableColumns.has(
                        columnName
                    )
            );
        },

        // =====================================================
        // LOAD COLUMNS FROM LOCAL STORAGE
        // =====================================================

        _loadSelectedColumns() {

            const availableColumns =
                new Set(
                    this._getAvailableColumns()
                );

            try {

                const storedValue =
                    window.localStorage.getItem(
                        this.storageKey
                    );


                // No saved preference yet.
                if (storedValue === null) {
                    return this._getDefaultColumns();
                }


                const parsedValue =
                    JSON.parse(storedValue);


                // Invalid storage.
                if (!Array.isArray(parsedValue)) {
                    return this._getDefaultColumns();
                }


                // Only allow columns that still exist.
                return parsedValue.filter(
                    (columnName) =>
                        typeof columnName === "string" &&
                        availableColumns.has(
                            columnName
                        )
                );

            } catch (error) {

                console.warn(
                    "[Fakir Portal CRM] " +
                    "Could not load optional columns.",
                    error
                );

                return this._getDefaultColumns();
            }
        },

        // =====================================================
        // SAVE COLUMNS
        // =====================================================

        _saveSelectedColumns(
            selectedColumns
        ) {

            try {

                window.localStorage.setItem(
                    this.storageKey,
                    JSON.stringify(
                        selectedColumns
                    )
                );

            } catch (error) {

                console.warn(
                    "[Fakir Portal CRM] " +
                    "Could not save optional columns.",
                    error
                );
            }
        },

        // =====================================================
        // GET CURRENTLY CHECKED COLUMNS
        // =====================================================

        _getCheckedColumns() {

            return this._getColumnToggles()
                .filter(
                    (toggle) =>
                        toggle.checked
                )
                .map(
                    (toggle) =>
                        toggle.value
                )
                .filter(Boolean);
        },

        // =====================================================
        // FIND TABLE CELLS FOR ONE COLUMN
        // =====================================================

        _getColumnElements(
            columnName
        ) {

            return Array.from(
                this.el.querySelectorAll(
                    ".fpm-crm-optional-column"
                )
            ).filter(
                (element) =>
                    element.dataset.column ===
                    columnName
            );
        },

        // =====================================================
        // SHOW / HIDE ONE COLUMN
        // =====================================================

        _setColumnVisibility(
            columnName,
            visible
        ) {

            const elements =
                this._getColumnElements(
                    columnName
                );

            elements.forEach(
                (element) => {
                    element.hidden =
                        !visible;
                }
            );
        },

        // =====================================================
        // APPLY COMPLETE COLUMN STATE
        // =====================================================

        _applyColumnState(
            selectedColumns
        ) {

            const selectedSet =
                new Set(
                    selectedColumns
                );


            this._getColumnToggles()
                .forEach(
                    (toggle) => {

                        const columnName =
                            toggle.value;


                        if (!columnName) {
                            return;
                        }


                        const visible =
                            selectedSet.has(
                                columnName
                            );


                        // Update checkbox.
                        toggle.checked =
                            visible;


                        // Update table.
                        this._setColumnVisibility(
                            columnName,
                            visible
                        );
                    }
                );
        },

        // =====================================================
        // OPTIONAL COLUMN CHECKBOX CHANGE
        //
        // Direct DOM event handler.
        // Works even after menu moves to <body>.
        // =====================================================

        _onFloatingColumnChange(ev) {

            const target =
                ev.target;


            if (
                !target ||
                !target.matches(
                    ".fpm-crm-column-toggle"
                )
            ) {
                return;
            }


            ev.stopPropagation();


            // Get all currently checked columns.
            const selectedColumns =
                this._getCheckedColumns();


            // Immediately update table.
            this._applyColumnState(
                selectedColumns
            );


            // Remember preference.
            this._saveSelectedColumns(
                selectedColumns
            );
        },

        // =====================================================
        // ROW CHECKBOXES
        // =====================================================

        _getRowCheckboxes() {

            return Array.from(
                this.el.querySelectorAll(
                    ".fpm-crm-row-checkbox"
                )
            );
        },

        // =====================================================
        // SELECT ALL
        // =====================================================

        _onSelectAll(ev) {

            ev.stopPropagation();


            const checked =
                ev.currentTarget.checked;


            this._getRowCheckboxes()
                .forEach(
                    (checkbox) => {
                        checkbox.checked =
                            checked;
                    }
                );


            this._updateSelectAllState();
        },

        // =====================================================
        // ROW CHECKBOX CLICK
        // =====================================================

        _onRowCheckboxClick(ev) {

            // Prevent opportunity row navigation.
            ev.stopPropagation();
        },

        // =====================================================
        // ROW CHECKBOX CHANGE
        // =====================================================

        _onRowCheckboxChange(ev) {

            ev.stopPropagation();

            this._updateSelectAllState();
        },

        // =====================================================
        // UPDATE SELECT ALL
        // =====================================================

        _updateSelectAllState() {

            const selectAll =
                this.el.querySelector(
                    "#fpmCrmSelectAll"
                );


            if (!selectAll) {
                return;
            }


            const rowCheckboxes =
                this._getRowCheckboxes();


            if (!rowCheckboxes.length) {

                selectAll.checked =
                    false;

                selectAll.indeterminate =
                    false;

                return;
            }


            const selectedCount =
                rowCheckboxes.filter(
                    (checkbox) =>
                        checkbox.checked
                ).length;


            // All selected.
            selectAll.checked =
                selectedCount ===
                rowCheckboxes.length;


            // Some selected.
            selectAll.indeterminate =
                selectedCount > 0 &&
                selectedCount <
                    rowCheckboxes.length;
        },

        // =====================================================
        // OPPORTUNITY ROW CLICK
        // =====================================================

        _onOpportunityRowClick(ev) {

            // -------------------------------------------------
            // Do not navigate when clicking an interactive
            // element inside the row.
            // -------------------------------------------------

            const interactiveElement =
                ev.target.closest(
                    [
                        "a",
                        "button",
                        "input",
                        "select",
                        "textarea",
                        "label",
                    ].join(",")
                );


            if (interactiveElement) {
                return;
            }


            // -------------------------------------------------
            // Read opportunity URL
            // -------------------------------------------------

            const row =
                ev.currentTarget;


            const targetUrl =
                row.dataset.url;


            // -------------------------------------------------
            // Basic URL safety
            // -------------------------------------------------

            if (
                !targetUrl ||
                !targetUrl.startsWith(
                    "/my/crm/opportunities/"
                )
            ) {
                return;
            }


            // -------------------------------------------------
            // Navigate
            // -------------------------------------------------

            window.location.assign(
                targetUrl
            );
        },
    });


// ============================================================================
// FAKIR PORTAL CRM
// CHATTER
//
// IMPORTANT:
// This is intentionally a separate publicWidget.
// It does not change or interfere with the Opportunity List widget above.
//
// Expected XML root:
//
//     #fpmCrmChatter
//
// Expected elements:
//
//     #fpmCrmSendMessageButton
//     #fpmCrmLogNoteButton
//     #fpmCrmChatterComposer
//     #fpmCrmChatterForm
//     #fpmCrmChatterMode
//     #fpmCrmChatterTextarea
//     #fpmCrmChatterSubmit
//     #fpmCrmChatterCancel
//     #fpmCrmChatterTimeline
//
// ============================================================================

publicWidget.registry.FakirPortalCrmChatter =
    publicWidget.Widget.extend({

        // =====================================================
        // WIDGET ROOT
        // =====================================================

        selector: "#fpmCrmChatter",


        // =====================================================
        // EVENTS
        // =====================================================

        events: {

            "click #fpmCrmSendMessageButton":
                "_onSendMessageClick",

            "click #fpmCrmLogNoteButton":
                "_onLogNoteClick",

            "click #fpmCrmChatterCancel":
                "_onCancelClick",

            "input #fpmCrmChatterTextarea":
                "_onTextareaInput",

            "keydown #fpmCrmChatterTextarea":
                "_onTextareaKeydown",

            "submit #fpmCrmChatterForm":
                "_onComposerSubmit",
        },


        // =====================================================
        // START
        // =====================================================

        start() {

            // -------------------------------------------------
            // Find Chatter elements.
            // -------------------------------------------------

            this.sendMessageButton =
                this.el.querySelector(
                    "#fpmCrmSendMessageButton"
                );

            this.logNoteButton =
                this.el.querySelector(
                    "#fpmCrmLogNoteButton"
                );

            this.composer =
                this.el.querySelector(
                    "#fpmCrmChatterComposer"
                );

            this.form =
                this.el.querySelector(
                    "#fpmCrmChatterForm"
                );

            this.modeInput =
                this.el.querySelector(
                    "#fpmCrmChatterMode"
                );

            this.textarea =
                this.el.querySelector(
                    "#fpmCrmChatterTextarea"
                );

            this.submitButton =
                this.el.querySelector(
                    "#fpmCrmChatterSubmit"
                );

            this.cancelButton =
                this.el.querySelector(
                    "#fpmCrmChatterCancel"
                );

            this.timeline =
                this.el.querySelector(
                    "#fpmCrmChatterTimeline"
                );


            // -------------------------------------------------
            // Current composer mode.
            //
            // message = Send Message
            // note    = Log Note
            // -------------------------------------------------

            this.composerMode = "message";


            // -------------------------------------------------
            // Initially hide composer.
            // -------------------------------------------------

            if (this.composer) {
                this.composer.classList.add(
                    "d-none"
                );
            }


            // -------------------------------------------------
            // Initial submit button state.
            // -------------------------------------------------

            this._updateSubmitButtonState();


            return this._super(...arguments);
        },


        // =====================================================
        // SEND MESSAGE BUTTON
        // =====================================================

        _onSendMessageClick(ev) {

            ev.preventDefault();

            this._openComposer(
                "message"
            );
        },


        // =====================================================
        // LOG NOTE BUTTON
        // =====================================================

        _onLogNoteClick(ev) {

            ev.preventDefault();

            this._openComposer(
                "note"
            );
        },


        // =====================================================
        // OPEN COMPOSER
        // =====================================================

        _openComposer(mode) {

            // Only allow known modes.
            if (
                mode !== "message" &&
                mode !== "note"
            ) {
                mode = "message";
            }


            this.composerMode =
                mode;


            // -------------------------------------------------
            // Hidden form value.
            // -------------------------------------------------

            if (this.modeInput) {
                this.modeInput.value =
                    mode;
            }


            // -------------------------------------------------
            // Show composer.
            // -------------------------------------------------

            if (this.composer) {
                this.composer.classList.remove(
                    "d-none"
                );
            }


            // -------------------------------------------------
            // Button appearance.
            // -------------------------------------------------

            this._updateModeButtons();


            // -------------------------------------------------
            // Textarea appearance / placeholder.
            // -------------------------------------------------

            this._updateComposerAppearance();


            // -------------------------------------------------
            // Submit button.
            // -------------------------------------------------

            this._updateSubmitButtonState();


            // -------------------------------------------------
            // Focus textarea.
            // -------------------------------------------------

            if (this.textarea) {

                window.requestAnimationFrame(
                    () => {

                        this.textarea.focus();

                        this.textarea.setSelectionRange(
                            this.textarea.value.length,
                            this.textarea.value.length
                        );
                    }
                );
            }
        },


        // =====================================================
        // CLOSE COMPOSER
        // =====================================================

        _closeComposer() {

            if (this.composer) {
                this.composer.classList.add(
                    "d-none"
                );
            }


            // -------------------------------------------------
            // Clear text.
            // -------------------------------------------------

            if (this.textarea) {
                this.textarea.value = "";
            }


            // -------------------------------------------------
            // Reset mode.
            // -------------------------------------------------

            this.composerMode =
                "message";


            if (this.modeInput) {
                this.modeInput.value =
                    "message";
            }


            // -------------------------------------------------
            // Reset button state.
            // -------------------------------------------------

            this._clearModeButtonState();

            this._updateComposerAppearance();

            this._updateSubmitButtonState();
        },


        // =====================================================
        // CANCEL
        // =====================================================

        _onCancelClick(ev) {

            ev.preventDefault();

            this._closeComposer();
        },


        // =====================================================
        // UPDATE MODE BUTTONS
        // =====================================================

        _updateModeButtons() {

            // -------------------------------------------------
            // Send Message
            // -------------------------------------------------

            if (this.sendMessageButton) {

                if (
                    this.composerMode ===
                    "message"
                ) {

                    this.sendMessageButton.classList.remove(
                        "btn-outline-primary"
                    );

                    this.sendMessageButton.classList.remove(
                        "btn-outline-secondary"
                    );

                    this.sendMessageButton.classList.add(
                        "btn-primary"
                    );

                } else {

                    this.sendMessageButton.classList.remove(
                        "btn-primary"
                    );

                    this.sendMessageButton.classList.add(
                        "btn-outline-primary"
                    );
                }
            }


            // -------------------------------------------------
            // Log Note
            // -------------------------------------------------

            if (this.logNoteButton) {

                if (
                    this.composerMode ===
                    "note"
                ) {

                    this.logNoteButton.classList.remove(
                        "btn-outline-secondary"
                    );

                    this.logNoteButton.classList.remove(
                        "btn-outline-primary"
                    );

                    this.logNoteButton.classList.add(
                        "btn-secondary"
                    );

                } else {

                    this.logNoteButton.classList.remove(
                        "btn-secondary"
                    );

                    this.logNoteButton.classList.add(
                        "btn-outline-secondary"
                    );
                }
            }
        },


        // =====================================================
        // CLEAR MODE BUTTON STATE
        // =====================================================

        _clearModeButtonState() {

            if (this.sendMessageButton) {

                this.sendMessageButton.classList.remove(
                    "btn-primary"
                );

                this.sendMessageButton.classList.add(
                    "btn-outline-primary"
                );
            }


            if (this.logNoteButton) {

                this.logNoteButton.classList.remove(
                    "btn-secondary"
                );

                this.logNoteButton.classList.add(
                    "btn-outline-secondary"
                );
            }
        },


        // =====================================================
        // COMPOSER APPEARANCE
        // =====================================================

        _updateComposerAppearance() {

            if (!this.textarea) {
                return;
            }


            // -------------------------------------------------
            // MESSAGE MODE
            // -------------------------------------------------

            if (
                this.composerMode ===
                "message"
            ) {

                this.textarea.placeholder =
                    "Write a message...";

                this.textarea.classList.remove(
                    "fpm-crm-chatter-note-input"
                );

                this.textarea.classList.add(
                    "fpm-crm-chatter-message-input"
                );


                if (this.submitButton) {

                    this.submitButton.innerHTML =
                        '<i class="fa fa-paper-plane me-1"></i>' +
                        "Send Message";

                    this.submitButton.classList.remove(
                        "btn-secondary"
                    );

                    this.submitButton.classList.add(
                        "btn-primary"
                    );
                }

                return;
            }


            // -------------------------------------------------
            // NOTE MODE
            // -------------------------------------------------

            this.textarea.placeholder =
                "Log an internal note...";

            this.textarea.classList.remove(
                "fpm-crm-chatter-message-input"
            );

            this.textarea.classList.add(
                "fpm-crm-chatter-note-input"
            );


            if (this.submitButton) {

                this.submitButton.innerHTML =
                    '<i class="fa fa-sticky-note-o me-1"></i>' +
                    "Log Note";

                this.submitButton.classList.remove(
                    "btn-primary"
                );

                this.submitButton.classList.add(
                    "btn-secondary"
                );
            }
        },


        // =====================================================
        // TEXTAREA INPUT
        // =====================================================

        _onTextareaInput() {

            this._updateSubmitButtonState();

            this._autoResizeTextarea();
        },


        // =====================================================
        // AUTO RESIZE TEXTAREA
        // =====================================================

        _autoResizeTextarea() {

            if (!this.textarea) {
                return;
            }


            // Reset height first.
            this.textarea.style.height =
                "auto";


            // Maximum composer height.
            const maximumHeight =
                180;


            const desiredHeight =
                Math.min(
                    this.textarea.scrollHeight,
                    maximumHeight
                );


            this.textarea.style.height =
                `${desiredHeight}px`;


            if (
                this.textarea.scrollHeight >
                maximumHeight
            ) {

                this.textarea.style.overflowY =
                    "auto";

            } else {

                this.textarea.style.overflowY =
                    "hidden";
            }
        },


        // =====================================================
        // SUBMIT BUTTON STATE
        // =====================================================

        _updateSubmitButtonState() {

            if (!this.submitButton) {
                return;
            }


            const hasText =
                Boolean(
                    this.textarea &&
                    this.textarea.value.trim()
                );


            this.submitButton.disabled =
                !hasText;
        },


        // =====================================================
        // KEYBOARD SHORTCUT
        //
        // Ctrl + Enter
        // or
        // Cmd + Enter
        //
        // submits composer.
        // =====================================================

        _onTextareaKeydown(ev) {

            if (
                ev.key !== "Enter" ||
                (!ev.ctrlKey && !ev.metaKey)
            ) {
                return;
            }


            ev.preventDefault();


            if (
                !this.form ||
                !this.textarea ||
                !this.textarea.value.trim()
            ) {
                return;
            }


            if (
                typeof this.form.requestSubmit ===
                "function"
            ) {

                this.form.requestSubmit();

            } else {

                this.form.submit();
            }
        },


        // =====================================================
        // FORM SUBMIT
        // =====================================================

        _onComposerSubmit(ev) {

            if (!this.textarea) {
                return;
            }


            const message =
                this.textarea.value.trim();


            // -------------------------------------------------
            // Prevent blank messages.
            // -------------------------------------------------

            if (!message) {

                ev.preventDefault();

                this.textarea.focus();

                this._updateSubmitButtonState();

                return;
            }


            // -------------------------------------------------
            // Make sure current mode reaches controller.
            // -------------------------------------------------

            if (this.modeInput) {
                this.modeInput.value =
                    this.composerMode;
            }


            // -------------------------------------------------
            // Prevent double submit.
            // -------------------------------------------------

            if (this.submitButton) {

                this.submitButton.disabled =
                    true;


                if (
                    this.composerMode ===
                    "note"
                ) {

                    this.submitButton.innerHTML =
                        '<i class="fa fa-spinner fa-spin me-1"></i>' +
                        "Logging...";

                } else {

                    this.submitButton.innerHTML =
                        '<i class="fa fa-spinner fa-spin me-1"></i>' +
                        "Sending...";
                }
            }
        },
    });


// ============================================================================
// EXPORT
// ============================================================================

export default
    publicWidget.registry.FakirPortalCrmOpportunityList;
// Opportunity detail product-line editor.
publicWidget.registry.FakirPortalCrmProductEditor = publicWidget.Widget.extend({
    selector: ".fpm-crm-record-card",
    events: {
        "click .fpm-add-product-row": "_addRow",
        "click .fpm-remove-product-row": "_removeRow",
        "change .fpm-product-select": "_syncRow",
        "input .fpm-product-quantity": "_recalculateFromEvent",
        "input .fpm-product-price": "_recalculateFromEvent",
        "change .fpm-product-taxes": "_taxesChanged",
    },
    start() {
        const result = this._super(...arguments);
        this.rows = this.el.querySelector(".fpm-product-rows");
        this.template = this.el.querySelector(".fpm-product-row-template");
        return result;
    },
    _addRow() {
        if (!this.rows || !this.template) return;
        this.rows.appendChild(this.template.content.cloneNode(true));
        this._recalculateTotal();
    },
    _removeRow(ev) {
        ev.currentTarget.closest(".fpm-product-row")?.remove();
        this._recalculateTotal();
    },
    _syncRow(ev) {
        const row = ev.currentTarget.closest(".fpm-product-row");
        const option = ev.currentTarget.selectedOptions[0];
        if (!row || !option) return;
        const set = (selector, value) => {
            const cell = row.querySelector(selector);
            if (cell) cell.textContent = value || "-";
        };
        set(".fpm-product-category", option.dataset.category);

        const price = row.querySelector(".fpm-product-price");
        if (price) price.value = option.dataset.price || "0.00";

        const taxes = row.querySelector(".fpm-product-taxes");
        const defaultTaxIds = (option.dataset.defaultTaxes || "").split(",").filter(Boolean);
        if (taxes) {
            Array.from(taxes.options).forEach((taxOption) => {
                taxOption.selected = defaultTaxIds.includes(taxOption.value);
            });
        }
        this._syncTaxHidden(row);
        this._recalculateRow(row);
    },
    _taxesChanged(ev) {
        const row = ev.currentTarget.closest(".fpm-product-row");
        if (!row) return;
        this._syncTaxHidden(row);
        this._recalculateRow(row);
    },
    _recalculateFromEvent(ev) {
        const row = ev.currentTarget.closest(".fpm-product-row");
        if (row) this._recalculateRow(row);
    },
    _syncTaxHidden(row) {
        const taxes = row.querySelector(".fpm-product-taxes");
        const hidden = row.querySelector(".fpm-product-tax-ids");
        if (!taxes || !hidden) return;
        hidden.value = Array.from(taxes.selectedOptions).map((option) => option.value).join(",");
    },
    _recalculateRow(row) {
        const quantity = parseFloat(row.querySelector(".fpm-product-quantity")?.value || "0") || 0;
        const price = parseFloat(row.querySelector(".fpm-product-price")?.value || "0") || 0;
        let total = quantity * price;
        const taxes = row.querySelector(".fpm-product-taxes");
        if (taxes) {
            Array.from(taxes.selectedOptions).forEach((option) => {
                const amount = parseFloat(option.dataset.amount || "0") || 0;
                if (option.dataset.amountType === "percent") total += quantity * price * amount / 100;
                else if (option.dataset.amountType === "fixed") total += quantity * amount;
            });
        }
        row.dataset.total = String(total);
        const amountCell = row.querySelector(".fpm-product-amount");
        if (amountCell) amountCell.textContent = total.toFixed(2);
        this._recalculateTotal();
    },
    _recalculateTotal() {
        if (!this.rows) return;
        let total = 0;
        this.rows.querySelectorAll(".fpm-product-row").forEach((row) => {
            if (row.dataset.total !== undefined) total += parseFloat(row.dataset.total || "0") || 0;
            else {
                const quantity = parseFloat(row.querySelector(".fpm-product-quantity")?.value || "0") || 0;
                const price = parseFloat(row.querySelector(".fpm-product-price")?.value || "0") || 0;
                total += quantity * price;
            }
        });
        const totalEl = this.el.querySelector(".fpm-product-total");
        if (totalEl) totalEl.textContent = total.toFixed(2);
    },
});
