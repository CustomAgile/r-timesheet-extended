Ext.define('Rally.technicalservices.UnapproveMenuItem', {
    extend: 'Rally.ui.menu.item.RecordMenuItem',
    alias: 'widget.tsunapprovemenuitem',


    config: {
        text: 'Unapprove',
        records: null
    },

    constructor: function(config) {
        config = config || {};

        config.predicate = config.predicate || this.shouldShowMenuItem;
        config.handler   = config.handler || this._unapproveRecords;
        
        this.initConfig(config);
        this.callParent([config]);
        if ( !this.records || this.records.length == 0 ) {
            this.records = [this.record];    // Handle 1 or more items
        }
    },
    
    shouldShowMenuItem: function(record) {
        return Ext.Array.every(this.records, function(r){
            return this._isUnapprovable(r);
        },this);
    },
    
    _isUnapprovable: function(record) {
        return ( record.get('__Status') && record.get('__Status') == TSTimesheet.STATUS.APPROVED );
    },
    
    _unapproveRecord: function(record) {
        if ( !record ) {
            Ext.Msg.alert("Problem unapproving record", "Can't find record");
            return;
        }
        
        record.unapprove();
    },
    
    _unapproveRecords: function() {
        Ext.Array.each(this.records, function(r) {
            this._unapproveRecord(r);
        }, this);
    }
});