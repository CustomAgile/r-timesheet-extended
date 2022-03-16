describe("Rally.technicalservices.TimeModelBuilder", function() {
    var startDay;
    var toDayName = Rally.technicalservices.TimeModelBuilder._getDayNameFromDayField;
    
    beforeAll(function() {
        spyOn(Rally, 'getApp').and.returnValue({
           getSetting: function() {
               return startDay;
           } 
        });
    });
    
    describe("_getTimeEntryForDayField", function() {
        var timeModelBuilder;
        
        beforeAll(function() {
            timeModelBuilder = Rally.technicalservices.TimeModelBuilder
            timeModelBuilder.get = jasmine.createSpy().and.returnValue(['1', '2']);
            spyOn(_, 'memoize').and.callFake(function(){
                
            });
        });
        
        it("setup the singleton", function() {
            expect(timeModelBuilder).toBeDefined();  
        });
        
        describe('Sunday week start', function() {
            var dayFields;
            
            beforeAll(function() {
                startDay = 'Sunday';
                dayFields = timeModelBuilder._getDayFields();
            });
            
            it('returns the first item for all days', function() {
                _.each(dayFields, function(dayField) {
                    // Only test the __Monday, etc fields, not the __Monday_record fields
                    if ( dayField.__src ) {
                        var dayName = toDayName(dayField.name);
                        expect(timeModelBuilder._getTimeEntryForDayName(dayName)).toEqual('1');
                    }
                });
            });
        });
        
        describe('Saturday week start', function() {
            var dayFields;
            
            beforeAll(function() {
                startDay = 'Saturday';
                dayFields = timeModelBuilder._getDayFields();
            });
            
            it('returns the first item for Saturday', function() {
                _.each(dayFields, function(dayField) {
                    // Only test the __Monday, etc fields, not the __Monday_record fields
                    if ( dayField.__src && dayField.name === '__Saturday') {
                        var dayName = toDayName(dayField.name);
                        expect(timeModelBuilder._getTimeEntryForDayName(dayName)).toEqual('1');
                    }
                });
            });
            
            it('returns the second item for all other days', function() {
                _.each(dayFields, function(dayField) {
                    // Only test the __Monday, etc fields, not the __Monday_record fields
                    if ( dayField.__src  && dayField.name != '__Saturday') {
                        var dayName = toDayName(dayField.name);
                        expect(timeModelBuilder._getTimeEntryForDayName(dayName)).toEqual('2');
                    }
                });
            });
        });
        
        describe('Monday week start', function() {
            var dayFields;
            
            beforeAll(function() {
                startDay = 'Monday';
                dayFields = timeModelBuilder._getDayFields();
            });
            
            it('returns the second item for Sunday', function() {
                _.each(dayFields, function(dayField) {
                    // Only test the __Monday, etc fields, not the __Monday_record fields
                    if ( dayField.__src && dayField.name === '__Sunday') {
                        var dayName = toDayName(dayField.name);
                        expect(timeModelBuilder._getTimeEntryForDayName(dayName)).toEqual('2');
                    }
                });
            });
            
            it('returns the first item for all other days', function() {
                _.each(dayFields, function(dayField) {
                    // Only test the __Monday, etc fields, not the __Monday_record fields
                    if ( dayField.__src  && dayField.name != '__Sunday') {
                        var dayName = toDayName(dayField.name);
                        expect(timeModelBuilder._getTimeEntryForDayName(dayName)).toEqual('1');
                    }
                });
            });
        });
        
        describe('Wednesday week start', function() {
            var dayFields;
            
            beforeAll(function() {
                startDay = 'Wednesday';
                dayFields = timeModelBuilder._getDayFields();
            });
            
            it('returns the first item for Wednesday', function() {
                _.each(dayFields, function(dayField) {
                    // Only test the __Monday, etc fields, not the __Monday_record fields
                    if ( dayField.__src && dayField.name === '__Wednesday') {
                        var dayName = toDayName(dayField.name);
                        expect(timeModelBuilder._getTimeEntryForDayName(dayName)).toEqual('1');
                    }
                });
            });
            
            it('returns the second item for Tuesday', function() {
                _.each(dayFields, function(dayField) {
                    // Only test the __Monday, etc fields, not the __Monday_record fields
                    if ( dayField.__src  && dayField.name === '__Tuesday') {
                        var dayName = toDayName(dayField.name);
                        expect(timeModelBuilder._getTimeEntryForDayName(dayName)).toEqual('2');
                    }
                });
            });
        });
    });
    
});
