/* for saving as default */

Ext.define('Rally.technicalservices.PinTimeEntryMenuItem', {
    extend: 'Rally.ui.menu.item.RecordMenuItem',
    alias: 'widget.tspintimeentrymenuitem',


    config: {
        text: 'Set As Default',
        records: []
    },

    constructor: function(config) {
        config = config || {};

        config.predicate = config.predicate || this.shouldShowMenuItem;
        config.handler   = config.handler || this._pinRecords;
        
        this.initConfig(config);
        this.callParent([config]);
    },
    
    shouldShowMenuItem: function(record) {
        return !record.isLocked() && !record.isPinned() && !record.isDeleted();
    },
    _pinRecord: function(record) {
        var timetable = this.view.ownerCt.ownerCt;
        
        timetable.pinTime(record);
    },
    
    _pinRecords: function() {
        var record = this.record;
        var records = this.records;
        
        if ( records.length === 0 ) {
            records = [record];
        }
        
        Ext.Array.each(records, function(record) {
            this._pinRecord(record);
        },this);
    }
});