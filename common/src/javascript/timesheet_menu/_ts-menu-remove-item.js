Ext.define('Rally.technicalservices.RemoveTimeEntryMenuItem', {
    extend: 'Rally.ui.menu.item.RecordMenuItem',
    alias: 'widget.tsremovetimeentrymenuitem',


    config: {
        text: 'Clear & Remove',
        records: []
    },

    constructor: function(config) {
        config = config || {};

        config.predicate = config.predicate || this.shouldShowMenuItem;
        config.handler   = config.handler || this._removeRecords;
        
        this.initConfig(config);
        this.callParent([config]);
    },
    
    shouldShowMenuItem: function(record) {
        return !record.isLocked();
    },
    _removeRecord: function(record) {
        record.clearAndRemove();
    },
    
    _removeRecords: function() {
        var record = this.record;
        var records = this.records;
        
        if ( records.length === 0 ) {
            records = [record];
        }
        
        Ext.Array.each(records, function(record) {
            this._removeRecord(record);
        },this);
    }
});