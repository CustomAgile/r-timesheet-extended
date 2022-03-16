Ext.define('Rally.technicalservices.UnprocessMenuItem', {
    extend: 'Rally.ui.menu.item.RecordMenuItem',
    alias: 'widget.tsunprocessmenuitem',


    config: {
        text: 'Unprocess',
        records: null
    },

    constructor: function(config) {
        config = config || {};

        config.predicate = config.predicate || this.shouldShowMenuItem;
        config.handler   = config.handler || this._unprocessRecords;
        
        this.initConfig(config);
        this.callParent([config]);
        if ( !this.records || this.records.length == 0 ) {
            this.records = [this.record];    // Handle 1 or more items
        }
    },
    
    shouldShowMenuItem: function(record) {
        return TSUtilities._currentUserCanUnprocess() && Ext.Array.every(this.records, function(r){
            return this._isUnprocessable(r);
        },this);
    },
    
    _isUnprocessable: function(record) {
        return ( record.get('__Status') && record.get('__Status') == TSTimesheet.STATUS.PROCESSED );
    },
    
    _unprocessRecord: function(record) {
        if ( !record ) {
            Ext.Msg.alert("Problem unprocessing record", "Can't find record");
            return;
        }
        
        record.unprocess();
    },
    
    _unprocessRecords: function() {
        Ext.Array.each(this.records, function(r) {
            this._unprocessRecord(r);
        }, this);
    }
});