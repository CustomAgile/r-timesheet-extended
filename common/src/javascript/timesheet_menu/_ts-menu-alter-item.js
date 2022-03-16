Ext.define('Rally.technicalservices.AlterTimeEntryMenuItem', {
    extend: 'Rally.ui.menu.item.RecordMenuItem',
    alias: 'widget.tsaltertimeentrymenuitem',


    config: {
        text: 'Alter Values',
        records: []
    },

    constructor: function(config) {
        config = config || {};

        config.predicate = config.predicate || this.shouldShowMenuItem;
        config.handler   = config.handler || this._alterRecords;
        
        this.initConfig(config);
        this.callParent([config]);
    },
    
    shouldShowMenuItem: function(record) {
        return !record.isLocked();
    },
    _alterRecord: function(record) {
        var timetable = this.view.ownerCt.ownerCt;
        
        timetable.cloneForAppending(record);
    },
    
    _alterRecords: function() {
        var record = this.record;
        var records = this.records;
        
        if ( records.length === 0 ) {
            records = [record];
        }
        
        Ext.Array.each(records, function(record) {
            this._alterRecord(record);
        },this);
    }
});