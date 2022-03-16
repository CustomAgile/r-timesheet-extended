/* global _ Ext Rally TSDateUtilities */
Ext.define('TSCommonSettings',{
    singleton: true,
    
    fetchManagerPortfolioItemFieldsSettingField: {
        name: 'fetchManagerPortfolioItemFields',
        xtype: 'rallyfieldcombobox',
        //multiSelect: true,    // This is buggy if enabled, when 2 or more values selected, setting control shows blank value
        //allowClear: true,
        allowBlank: true,
        allowNoEntry: true,
        //model: null, // Set to TSUtilities.getLowestPortfolioItemTypeName() after initLowestPortfolioItemTypeName() has been called
        fieldLabel: "Extra Portfolio Item Fields",
    },
    getManagerPortfolioItemFetchFields: function() {
        var fetchManagerPortfolioItemFields = Rally.getApp().getSetting('fetchManagerPortfolioItemFields');
        // this value is from a rallyfieldcombobox which doesn't behave predictably when multi-select enabled.
        // Sometimes an array of strings, sometimes a CSV string. Normalize to array of strings
        if ( Ext.typeOf(fetchManagerPortfolioItemFields) === 'string') {
            fetchManagerPortfolioItemFields = fetchManagerPortfolioItemFields != '' ? fetchManagerPortfolioItemFields.split(',') : []
        }
        return fetchManagerPortfolioItemFields || [];
    },
    allowManagerEditSettingsField: {
        name: 'allowManagerEdit',
        xtype: 'rallycheckboxfield',
        boxLabelAlign: 'after',
        fieldLabel: '',
        boxLabel: 'Allow Edit<br/><span style="color:#999999;"><i>Tick to allow manager to edit user timesheets.</i></span>'
    },
    isManagerEditAllowed: function() {
        return Rally.getApp().getSetting('allowManagerEdit') === true;
    },
    
    initLowestPortfolioItemTypeName: function() {
        return Ext.create('Rally.data.wsapi.Store', {
            model: Ext.identityFn('TypeDefinition'),
            fetch: ['Name', 'Ordinal', 'TypePath'],
            sorters: {
                property: 'Ordinal',
                direction: 'ASC'
            },
            filters: [
                {
                    property: 'Creatable',
                    operator: '=',
                    value: 'true'
                },
                {
                    property: 'Parent.Name',
                    operator: '=',
                    value: 'Portfolio Item'
                }
            ]
        }).load().then({
            scope: this,
            success: function(results) {
                return this.lowestPortfolioItemTypeName = results[0].get('Name');
            }
        });
    },
    
    getLowestPortfolioItemTypeName: function() {
        return this.lowestPortfolioItemTypeName || 'Feature'
    },
    
    getStartDayOfWeekSettingField: function() {
        return {
            xtype: 'rallycombobox',
            name: 'startDayOfWeek',
            fieldLabel: 'Week starts on',
            store: Ext.create('Ext.data.Store', {
                fields: ['Name'],
                data : _.map(TSDateUtils.daysOfWeek, function(dayName) {
                  return { Name: dayName }  
                })
            }),
            queryMode: 'local',
            displayField: 'Name',
            valueField: 'Name',
        };
    },
    
    getStartDayOfWeek: function() {
        return Rally.getApp().getSetting('startDayOfWeek') || 'Sunday';  
    }
});