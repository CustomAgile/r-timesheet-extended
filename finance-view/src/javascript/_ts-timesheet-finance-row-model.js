var TSTimesheetFinanceCalculators = {
    calculateWeekNumber: function(value, record) {
        var week_date = record.get('DateVal');
        
        if ( !Ext.isDate(week_date) ) {
            return -1;
        }
        
        var offset = week_date.getTimezoneOffset();
        // 480 is pacific, -330 is india
        // datevals are set to the london midnight for that day, so shifting to pacific
        // will put Tuesday on Monday, but India will be fine for week day
        var shifted_week_date = week_date;
        // ISO-8601 has week number starting on Monday,
        // shift 24 hours to get to start on Tuesday
        if ( offset > 0 ) {
            shifted_week_date = Rally.util.DateTime.add(week_date,'minute',offset+1440);
        } else {
            shifted_week_date = Rally.util.DateTime.add(week_date,'minute',1440);
        }
        
        
        
        return parseInt( Ext.Date.format(shifted_week_date, 'W', 10) );
    }
};

Ext.define('TSTimesheetFinanceRow',{
    extend: 'Ext.data.Model',
    
    fields: [
        { name: '__ChangeType', type:'string' },
        { name: '__WorkItem', type:'object' },
        { name: '__WorkItemDisplay', type:'string' },
        { name: 'User', type: 'object' },
        { name: '__Location', type:'string' },
        { name: '__AssociateID', type:'string' },
        { name: '__EmployeeType', type:'string' },
        { name: '__CostCenter', type: 'string' },
        { name: '__Status', type: 'object' },
        { name: '__LastUpdateBy', type: 'object' },
        { name: '__LastUpdateDate', type: 'date' },
        { name: '__Task', type:'object' },
        { name: '__IsOpEx', type: 'boolean', defaultValue: false },
        { name: 'WeekStartDate', type: 'date' },
        { name: '__Product', type:'object' },
        { name: '__Release', type: 'object' },
        { name: 'DateVal', type: 'date' },
        { name: 'Hours', type: 'float' },
        
        /* calculated fields */
        { name: '___WeekNumber', type:'int', defaultValue: -1, convert:  TSTimesheetFinanceCalculators.calculateWeekNumber }
    ],
    
    getPreferenceKey: function() {
        // get or create and then update pref
        return Ext.String.format("{0}.{1}.{2}", 
            this._approvalKeyPrefix,
            TSDateUtils.getUtcIsoForLocalDate(this.get('WeekStartDate')),
            this.get('User').ObjectID
        );
    }
    
});