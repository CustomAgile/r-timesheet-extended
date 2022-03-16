/* for saving as default */

Ext.define('Rally.technicalservices.UnpinTimeEntryMenuItem', {
    extend: 'Rally.ui.menu.item.RecordMenuItem',
    alias: 'widget.tsunpintimeentrymenuitem',


    config: {
        text: 'Remove Default',
        records: []
    },

    constructor: function(config) {
        config = config || {};

        config.predicate = config.predicate || this.shouldShowMenuItem;
        config.handler   = config.handler || this._unpinRecords;
        
        this.initConfig(config);
        this.callParent([config]);
    },
    
    shouldShowMenuItem: function(record) {
        return !record.isLocked() && record.isPinned() && !record.isDeleted();
    },
    _unpinRecord: function(record) {
        var timetable = this.view.ownerCt.ownerCt;
        
        timetable.unpinTime(record);
    },
    
    _unpinRecords: function() {
        var record = this.record;
        var records = this.records;
        
        if ( records.length === 0 ) {
            records = [record];
        }
        
        Ext.Array.each(records, function(record) {
            this._unpinRecord(record);
        },this);
    }
});