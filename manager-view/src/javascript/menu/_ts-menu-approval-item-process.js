Ext.define('Rally.technicalservices.ProcessMenuItem', {
    extend: 'Rally.ui.menu.item.RecordMenuItem',
    alias: 'widget.tsprocessmenuitem',


    config: {
        text: 'Process',
        records: null
    },

    constructor: function(config) {
        config = config || {};

        config.predicate = config.predicate || this.shouldShowMenuItem;
        config.handler   = config.handler || this._processRecords;
        
        this.initConfig(config);
        this.callParent([config]);
        if ( !this.records || this.records.length == 0 ) {
            this.records = [this.record];    // Handle 1 or more items
        }
    },
    
    shouldShowMenuItem: function(record) {
        return TSUtilities._currentUserCanProcess() && Ext.Array.every(this.records, function(r){
            return this._isProcessable(r);
        },this);
    },
    
    _isProcessable: function(record) {
        return ( record.get('__Status') &&
            (record.get('__Status') == TSTimesheet.STATUS.APPROVED || record.get('__Status') == TSTimesheet.STATUS.SUBMITTED )
        );
    },
    
    _processRecord: function(record) {
        if ( !record ) {
            Ext.Msg.alert("Problem processing record", "Can't find record");
            return;
        }
        
        record.process();
    },
    
    _processRecords: function() {
        Ext.Array.each(this.records, function(r) {
            this._processRecord(r);
        },this);
    }
});