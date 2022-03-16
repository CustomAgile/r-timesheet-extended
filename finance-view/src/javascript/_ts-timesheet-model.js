Ext.define('TSTimesheet',{
    extend: 'Ext.data.Model',
    
    _approvalKeyPrefix: 'rally.technicalservices.timesheet.status',
    
    fields: [
        { name: '__UserName', type:'object' },
        { name: '__Hours',  type: 'float',  defaultValue: 0 },
        { name: '__Status', type: 'string', defaultValue: 'Unknown' }, // Open, Approved, Locked
        { name: 'User', type: 'object' },
        { name: 'WeekStartDate', type: 'date' },
        { name: '__LastUpdateBy', type: 'object' },
        { name: '__LastUpdateDate', type: 'date' },
        { name: '__AllTimeEntryItems', type: 'object' },
        { name: '__TimeEntryValues', type: 'object' },
        { name: '__TimeEntryChanges', type: 'object', defaultValue: [] }
    ],
    
    isSelectable: function() {
        return true;
    },
    
    getWeekStart: function() {
        var start_date = new Date(this.get('WeekStartDate'));
        start_date = Rally.util.DateTime.toIsoString(
            new Date(start_date.getUTCFullYear(), 
                start_date.getUTCMonth(), 
                start_date.getUTCDate(),  
                start_date.getUTCHours(), 
                start_date.getUTCMinutes(), 
                start_date.getUTCSeconds()
            )
        ).replace(/T.*$/,'');
        return start_date;
    },
    
    getPreferenceKey: function() {
        // get or create and then update pref
        return Ext.String.format("{0}.{1}.{2}", 
            this._approvalKeyPrefix,
            this.getWeekStart(),
            this.get('User').ObjectID
        );
    }
    
});