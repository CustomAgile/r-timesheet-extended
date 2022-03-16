
Ext.define('Rally.technicalservices.TimeApprovalRecordMenu', {
    extend: 'Rally.ui.menu.RecordMenu',
    alias: 'widget.tstimeapprovalrecordmenu',

    config: {

        /**
         * @cfg {Rally.data.Model} record (required)
         * The record to build the menu for
         */
        record: null,

        /**
         * @cfg {Ext.Element|HTMLElement} (optional) owningEl
         * The element this menu item is being invoked against.
         */
        owningEl: undefined

    },

    initComponent: function() {
        this.items = this._getMenuItems();
        
        this.callParent(arguments);
    },

    _getMenuItems: function() {
        var record = this.getRecord(),
            records = this.records || [record],
            items = [],
            popoverPlacement = this.popoverPlacement || Rally.ui.popover.Popover.DEFAULT_PLACEMENT;

        items.push({
            xtype: 'tsapprovemenuitem',
            view: this.view,
            record: record,
            records: records
        });
        
        items.push({
            xtype: 'tsunapprovemenuitem',
            view: this.view,
            record: record,
            records: records
        });
        
        items.push({
            xtype: 'tsprocessmenuitem',
            view: this.view,
            record: record,
            records: records
        });
        
        items.push({
            xtype: 'tsunprocessmenuitem',
            view: this.view,
            record: record,
            records: records
        });
        
        return items;
    }
});