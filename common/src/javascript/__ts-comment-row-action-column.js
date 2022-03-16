Ext.define('Rally.technicalservices.grid.comments.RowActionColumn', {
    extend: 'Ext.grid.column.Column',
    alias: 'widget.tscommentrowactioncolumn',
    
    /**
     * @property {Boolean} sortable False to disable sorting of this column
     *
     */
    sortable: false,
    /**
     * @property {Boolean} hideable False to disable hiding of column
     *
     */
    hideable: false,
    /**
     * @property {Boolean} resizable False to disable resizing of column
     *
     */
    resizable: false,
    /**
     * @property {Boolean} draggable False to disable reordering of a column
     *
     */
    draggable: false,
    /**
     * @property {Boolean} menuDisabled True to disable the column header menu containing sort/hide options
     *
     */
    menuDisabled: true,
    /**
     * @property {Number}
     *
     */
    flex: -1,
    minWidth: Ext.isIE9 ? 22 : 26,
    maxWidth: Ext.isIE9 ? 22 : 26,

    /**
     * @property {Boolean}
     * This column should not show up on print pages that include a printable grid
     */
    printable: false,

    tdCls: 'rally-cell-row-action',
    cls: 'row-action-column-header',

    config: {
        /**
         * @cfg {Function} rowActionsFn
         * A list of Rally.ui.menu.Menu#items objects that will be used as the row action options
         * Each row action can contain a predicate property which will be evaluated to see if the row action should be included
         * Usage:
         *  rowActionsFn: function(record) {
         *      return [
         *           {text: 'Remove', record: record, handler: function(){  } }
         *      ]
         *   }
         */
        rowActionsFn: null,

        /**
         * @cfg {Object} scope The scope that the rowActionsFn is called with
         */
        scope: null,
        
        canUnlock: false
    },

    constructor: function() {
        this.callParent(arguments);
        this.renderer = this._renderGearIcon;
    },

    initComponent: function() {
        this.callParent(arguments);
        this.on('click', this._showMenu, this);
    },

    onDestroy: function() {
        if (this.menu) {
            this.menu.destroy();
            delete this.menu;
        }

        this.callParent(arguments);
    },

    /**
     * @private
     * @param value
     * @param metaData
     * @param record
     */
    _renderGearIcon: function(value, metaData, record) {
        metaData.tdCls = Rally.util.Test.toBrowserTestCssClass('row-action', Rally.util.Ref.getOidFromRef(record.get('_ref')));
        return '<div class="row-action-icon icon-gear"/>';
    },

    /**
     * @private
     * @param view
     * @param el
     */
    _showMenu: function(view, el) {
        var selectedRecord = view.getRecord(Ext.fly(el).parent("tr")),
            checkedRecords = view.getSelectionModel().getSelection(),
            grid = view.panel,
            defaultOptions;

        defaultOptions = {
            view: view,
            record: selectedRecord,
            records: checkedRecords,
            owningEl: el.parentElement,
            popoverPlacement: ['bottom', 'top'],
            canUnlock: this.canUnlock
        };

        if (this.rowActionsFn) {
            var config = Ext.apply({
                items: this.rowActionsFn.call(this.scope || this, selectedRecord, view)
            }, defaultOptions);
            
            this.menu = Ext.create('Rally.ui.menu.Menu', config);
        } else {
            this.menu = this._getDefaultRecordMenu(selectedRecord, defaultOptions);
        }

        this.menu.showBy(Ext.fly(el).down(".row-action-icon"));
    },

    _getDefaultRecordMenu: function(selectedRecord, defaultOptions) {
        var menu;
        var menuOptions = Ext.merge(defaultOptions, this.menuOptions || {});
        return Ext.create('Rally.technicalservices.RecordMenu', menuOptions);
    }
});