Ext.define('Rally.technicalservices.AbsorbTimeEntryMenuItem', {
    extend: 'Rally.ui.menu.item.RecordMenuItem',
    alias: 'widget.tsabsorbtimeentrymenuitem',


    config: {
        text: 'Absorb Values',
        records: []
    },

    constructor: function(config) {
        config = config || {};

        config.predicate = config.predicate || this.shouldShowMenuItem;
        config.handler   = config.handler || this._absorbRecords;
        
        this.initConfig(config);
        this.callParent([config]);
    },
    
    shouldShowMenuItem: function(record) {
        return !record.isLocked();
    },
    _absorbRecord: function(record) {
        var timetable = this.view.ownerCt.ownerCt;
        
        timetable.absorbTime(record);
    },
    
    _absorbRecords: function() {
        var record = this.record;
        var records = this.records;
        
        if ( records.length === 0 ) {
            records = [record];
        }
        
        Ext.Array.each(records, function(record) {
            this._absorbRecord(record);
        },this);
    }
});