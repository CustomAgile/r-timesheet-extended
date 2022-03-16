Ext.define('Rally.technicalservices.ApproveMenuItem', {
    extend: 'Rally.ui.menu.item.RecordMenuItem',
    alias: 'widget.tsapprovemenuitem',


    config: {
        text: 'Approve',
        records: null
    },

    constructor: function(config) {
        config = config || {};

        config.predicate = config.predicate || this.shouldShowMenuItem;
        config.handler   = config.handler || this._approveRecords;
        
        this.initConfig(config);
        this.callParent([config]);
        if ( !this.records || this.records.length == 0 ) {
            this.records = [this.record];    // Handle 1 or more items
        }
    },
    
    shouldShowMenuItem: function(record) {
        return Ext.Array.every(this.records, function(r){
            return this._isApprovable(r);
        },this);
    },
    
    _isApprovable: function(record) {
        return ( record.get('__Status') && record.get('__Status') === TSTimesheet.STATUS.SUBMITTED );
    },
    
    _approveRecord: function(record) {
        if ( !record ) {
            Ext.Msg.alert("Problem approving record", "Can't find record");
            return;
        }
        
        record.approve();
    },
    
    _approveRecords: function() {
        Ext.Array.each(this.records, function(r) {
            this._approveRecord(r);
        },this);
    }
});