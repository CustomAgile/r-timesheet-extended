describe("TSDateUtils", function() {
    var startDay;
    
    beforeAll(function() {
        spyOn(Rally, 'getApp').and.returnValue({
           getSetting: function() {
               return startDay;
           } 
        });
    });
    
    describe('getWeekStartDates', function() {
        it('is defined', function() {
            expect(TSDateUtils.getWeekStartDates).toBeDefined();
        });
        
        it('returns no items if end < start', function() {
            var today = new Date('2018-05-02');
            var yesterday = new Date('2018-05-01');
            expect(TSDateUtils.getWeekStartDates(today, yesterday).length).toEqual(0);
        });
        
        it('returns no items if missing start or end', function() {
            expect(TSDateUtils.getWeekStartDates(new Date(), undefined).length).toEqual(0);
            expect(TSDateUtils.getWeekStartDates(undefined, new Date()).length).toEqual(0);
        });
        
        it('returns one item when start and end are the same', function() {
            var today = new Date();
            expect(TSDateUtils.getWeekStartDates(today, today).length).toEqual(1);
        });
        
        it('returns one item when start and end are less than one week apart', function() {
            var today = new Date('2018-05-06');
            var nextWeek = new Date('2018-05-12');
            expect(TSDateUtils.getWeekStartDates(today, nextWeek).length).toEqual(1);
        });
        it('returns two items when start and end are one week apart', function() {
            var today = new Date('2018-05-06');
            var nextWeek = new Date('2018-05-13');
            expect(TSDateUtils.getWeekStartDates(today, nextWeek).length).toEqual(2);
        });
        it('returns two items when start and end are less than two weeks apart', function() {
            var today = new Date('2018-05-06');
            var nextWeek = new Date('2018-05-14');
            expect(TSDateUtils.getWeekStartDates(today, nextWeek).length).toEqual(2);
        });
        it('returns three items when start and end are three weeks apart', function() {
            var today = new Date('2018-05-06');
            var nextWeek = new Date('2018-05-20');
            expect(TSDateUtils.getWeekStartDates(today, nextWeek).length).toEqual(3);
        });
    });
    
    describe("getDaysOfWeek", function() {
        
        describe('Sunday week start', function() {
            var dayFields;
            beforeAll(function() {
                startDay = 'Sunday';
            });
            
            it('returns days starting with Sunday', function() {
                var expectedDayOfWeek = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
                var daysOfWeek = TSDateUtils.getDaysOfWeek();
                expect(_.difference(daysOfWeek, expectedDayOfWeek).length).toEqual(0);
            });
        });
        
        describe('Saturday week start', function() {
            var dayFields;
            
            beforeAll(function() {
                startDay= 'Saturday';
            });
            
            it('returns days starting with Saturday', function() {
                var expectedDayOfWeek = ['Saturday', 'Sunday','Monday','Tuesday','Wednesday','Thursday','Friday'];
                var daysOfWeek = TSDateUtils.getDaysOfWeek();
                expect(_.difference(daysOfWeek, expectedDayOfWeek).length).toEqual(0);
            });
        });
        
        describe('Monday week start', function() {
            var dayFields;
            
            beforeAll(function() {
                startDay = 'Monday';
            });
            
            it('returns days starting with Monday', function() {
                var expectedDayOfWeek = ['Monday','Tuesday','Wednesday','Thursday','Friday', 'Saturday', 'Sunday'];
                var daysOfWeek = TSDateUtils.getDaysOfWeek();
                expect(_.difference(daysOfWeek, expectedDayOfWeek).length).toEqual(0);
            });
        });
    });
    
    describe('getUtcSundayWeekStartStrings', function() {
        var dateRange = _.range(6,13);
        
        describe('Sunday week start', function() {
            beforeAll(function() {
                startDay = 'Sunday';
            });
            
            it('Every day of week returns 1 week start string', function() {
                _.each(dateRange, function(day) {
                    var startDate = new Date('5-' + day + '-2018');
                    var weekStartStrings = TSDateUtils.getUtcSundayWeekStartStrings(startDate);
                    expect(weekStartStrings.length).toEqual(1);
                });
            });
        });
        
        describe('Saturday week start', function() {
            beforeAll(function() {
                startDay = 'Saturday';
            });
            
            it('Every day of week returns 2 week start strings', function() {
                _.each(dateRange, function(day) {
                    var startDate = new Date('5-' + day + '-2018');
                    var weekStartStrings = TSDateUtils.getUtcSundayWeekStartStrings(startDate);
                    expect(weekStartStrings.length).toEqual(2);
                });
            });
        });
        
        describe('Monday week start', function() {
            beforeAll(function() {
                startDay = 'Monday';
            });
            
            it('Every day of week returns 2 week start strings', function() {
                _.each(dateRange, function(day) {
                    var startDate = new Date('5-' + day + '-2018');
                    var weekStartStrings = TSDateUtils.getUtcSundayWeekStartStrings(startDate);
                    expect(weekStartStrings.length).toEqual(2);
                });
            });
        });
    });
    
    describe('getBeginningOfWeekForLocalDate', function() {
        describe('Sunday week start', function() {
            var dayFields;
            
            beforeAll(function() {
                startDay = 'Sunday';
            });
            
            it('Saturday returns prior Sunday', function() {
                var date = new Date('5-5-2018');
                var result = TSDateUtils.getBeginningOfWeekForLocalDate(date);
                expect(result.toDateString()).toEqual('Sun Apr 29 2018');
            });
            
            it('Sunday returns same Sunday', function() {
                var date = new Date('5-6-2018');
                var result = TSDateUtils.getBeginningOfWeekForLocalDate(date);
                expect(result.toDateString()).toEqual('Sun May 06 2018');
            });
            
            it('Monday returns prior Sunday', function() {
                var date = new Date('5-7-2018');
                var result = TSDateUtils.getBeginningOfWeekForLocalDate(date);
                expect(result.toDateString()).toEqual('Sun May 06 2018');
            });
        });
        
        describe('Saturday week start', function() {
            var dayFields;
            
            beforeAll(function() {
                startDay = 'Saturday';
            });
            
            it('Friday returns prior Saturday', function() {
                var date = new Date('5-4-2018');
                var result = TSDateUtils.getBeginningOfWeekForLocalDate(date);
                expect(result.toDateString()).toEqual('Sat Apr 28 2018');
            });
        
            it('Saturday returns same Saturday', function() {
                var date = new Date('5-5-2018');
                var result = TSDateUtils.getBeginningOfWeekForLocalDate(date);
                expect(result.toDateString()).toEqual('Sat May 05 2018');
            });
            
            it('Sunday returns prior Saturday', function() {
                var date = new Date('5-6-2018');
                var result = TSDateUtils.getBeginningOfWeekForLocalDate(date);
                expect(result.toDateString()).toEqual('Sat May 05 2018');
            });
        });
        
        describe('Monday week start', function() {
            var dayFields;
            
            beforeAll(function() {
                startDay = 'Monday';
            });
            
            it('Sunday returns prior Monday', function() {
                var date = new Date('5-6-2018');
                var result = TSDateUtils.getBeginningOfWeekForLocalDate(date);
                expect(result.toDateString()).toEqual('Mon Apr 30 2018');
            });
            
            it('Monday returns same Monday', function() {
                var date = new Date('5-7-2018');
                var result = TSDateUtils.getBeginningOfWeekForLocalDate(date);
                expect(result.toDateString()).toEqual('Mon May 07 2018');
            });
            
            it('Tuesday returns prior Monday', function() {
                var date = new Date('5-8-2018');
                var result = TSDateUtils.getBeginningOfWeekForLocalDate(date);
                expect(result.toDateString()).toEqual('Mon May 07 2018');
            });
        });
    });
    
});
