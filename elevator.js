{
  init: function(elevators, floors) {

    // Create floor object from floor
    function createFloorObj(floor, index) {
      var floorObj = {
        upArrowOn: false,
        downArrowOn: false,
        floorNum: floor.floorNum()
      };

      floor.on('up_button_pressed', function() {
        floorObj.upArrowOn = true;
        wakeAnIdleElevator();
      });

      floor.on('down_button_pressed', function() {
        floorObj.downArrowOn = true;
        wakeAnIdleElevator();
      });

      return floorObj;
    }

    function getFloorsStatus() {      
      var logs = _.map(floorObjs, function(floorObj) {
        return '( ' + (floorObj.upArrowOn ? '▲' : '-') + ' ' + (floorObj.downArrowOn ? '▼' : '-') + ' )';
      }, this);
      return logs.join(' ');
    }

    // Create an array of floor objects (one for each floor)
    var floorObjs = _.map(floors, createFloorObj, this);
    
    // Create elevator object from elevator
    function createElevatorObj(elevator, index) {
      var elevatorObj = {
        id: index,
        elevator: elevator,
        destinationFloor: NaN,
        goingUp: true,

        // spread the default floor for each elevator evenly throughout the floors
        //defaultFloor: Math.floor((index / elevators.length) * floors.length),
        defaultFloor: (index % (floors.length / 2)),

        // creates an array with a false (button off) for every floor
        floorButtonOn: _.map(floors, function() {
          return false;
        }, this),

        hasRoom: function() {
          return elevator.loadFactor() < 0.3;
        },

        currentFloor: function() {
          return elevator.currentFloor();
        },

        updateArrowIndicator: function() {
          elevator.goingUpIndicator(elevatorObj.goingUp);
          elevator.goingDownIndicator(!elevatorObj.goingUp);
        },

        isGoodDestination: function(floorNum) {

          // did someone press the button for this floor inside the elevator
          if (elevatorObj.floorButtonOn[floorNum]) {
            return true;
          }

          // did someone press a button to call an elevator to this floor
          if (floorObjs[floorNum].upArrowOn || floorObjs[floorNum].downArrowOn) {

            var floorDistance = Math.abs(floorNum - elevatorObj.currentFloor());

            // if so, make sure a closer elevator going in our direction isn't already
            // going to this destination
            for (var i = 0; i < elevatorObjs.length; i++) {
              var otherElevatorObj = elevatorObjs[i];
              var otherFloorDistance = Math.abs(floorNum - otherElevatorObj.currentFloor());

              if (elevatorObj !== otherElevatorObj &&
                otherFloorDistance <= floorDistance &&
                otherElevatorObj.destinationFloor === floorNum &&
                otherElevatorObj.goingUp === elevatorObj.goingUp &&
                otherElevatorObj.hasRoom())
              {
                // another elevator already handling this one, so not a good choice
                return false;
              }
            }

            // no other elevator handling this one
            return true;
          }

          return false;
        },

        getBottomFloorToVisit: function() {
          for (var floorNum = 0; floorNum < floors.length; floorNum++) {
            if (elevatorObj.isGoodDestination(floorNum)) {
              return floorNum;
            }
          }
        },

        getTopFloorToVisit: function() {
          for (var floorNum = elevatorObj.floorButtonOn.length - 1; floorNum >= 0; floorNum--) {
            if (elevatorObj.isGoodDestination(floorNum)) {
              return floorNum;
            }
          }
        },

        setDestinationFloor: function(floorNum) {
          elevatorObj.destinationFloor = floorNum;

          elevator.destinationQueue = [];
          if (_.isFinite(floorNum)) {
            elevator.destinationQueue.push(floorNum);
            elevatorObj.goingUp = (floorNum >= elevatorObj.currentFloor());
          }
          elevatorObj.updateArrowIndicator();
          elevator.checkDestinationQueue();
        },

        updateDesitnationFloor: function() {
          var floorToVisit;
          if (elevatorObj.goingUp) {            
            floorToVisit = elevatorObj.getTopFloorToVisit();
            if (!_.isFinite(floorToVisit)) {
              floorToVisit = elevatorObj.getBottomFloorToVisit();
              elevatorObj.goingUp = false;
            }
          } else {
            floorToVisit = elevatorObj.getBottomFloorToVisit();
            if (!_.isFinite(floorToVisit)) {
              floorToVisit = elevatorObj.getTopFloorToVisit();
              elevatorObj.goingUp = true;
            }
          }

          if (!_.isFinite(floorToVisit)) {
            floorToVisit = elevatorObj.defaultFloor;
          }

          elevatorObj.setDestinationFloor(floorToVisit);
          elevatorObj.logStatus('updateDesitnationFloor');
        },

        logStatus: function() {          
          //if (elevatorObj.id !== 0) return;
          console.log('Elevator', elevatorObj.id, '-', arguments);
          console.log('currentFloor:', elevatorObj.currentFloor());
          console.log('goingUp:', elevatorObj.goingUp, '( ', elevator.goingUpIndicator() ? '▲' : '-', ' ', elevator.goingDownIndicator() ? '▼' : '-', ' )');
          console.log('destinationFloor:', elevatorObj.destinationFloor);
          console.log('destinationQueue:', elevator.destinationQueue);          
          console.log('floorButtonOn:', elevatorObj.floorButtonOn);
          console.log('floors', getFloorsStatus());
          console.log('load', elevator.loadFactor());
          console.log('');
        }
      };

      elevator.on("floor_button_pressed", function(floorNum) {
        elevatorObj.floorButtonOn[floorNum] = true;
        elevatorObj.updateDesitnationFloor();
      });

      elevator.on("passing_floor", function(floorNum, direction) {
        // Just in case the final floor we should be targetting has changed since last floor
        elevatorObj.updateDesitnationFloor();
        
        var floorObj = floorObjs[floorNum];
        var hasRoom = elevatorObj.hasRoom();
        if ((elevatorObj.floorButtonOn[floorNum]) ||
            (elevatorObj.goingUp && floorObj.upArrowOn && hasRoom) ||
            (!elevatorObj.goingUp && floorObj.downArrowOn && hasRoom))
        {
          elevator.goToFloor(floorNum, true);
        }        

        elevatorObj.logStatus('passing_floor');
      });

      elevator.on('stopped_at_floor', function(floorNum) {
        var floorObj = floorObjs[floorNum];

        if (elevatorObj.destinationFloor === floorNum) {
          elevatorObj.destinationFloor = NaN;
          if (elevatorObj.goingUp && !floorObj.upArrowOn && floorObj.downArrowOn) {
            elevatorObj.goingUp = false;
            elevatorObj.updateArrowIndicator();
          } else if (!elevatorObj.goingUp && floorObj.upArrowOn && !floorObj.downArrowOn) {
            elevatorObj.goingUp = true;
            elevatorObj.updateArrowIndicator();
          } else if (!floorObj.upArrowOn && !floorObj.downArrowOn) {
            elevatorObj.updateDesitnationFloor();
          }
        }

        // turn off inside elevator button for floor
        elevatorObj.floorButtonOn[floorNum] = false;
                
        // turn off floor arrow buttons if needed
        if (elevatorObj.goingUp && floorObj.upArrowOn) {
          floorObj.upArrowOn = false;
        } else if (!elevatorObj.goingUp && floorObj.downArrowOn) {
          floorObj.downArrowOn = false;
        }

        elevatorObj.logStatus('stopped_at_floor');
      });

      elevator.on('idle', function() {
        elevator.goingUpIndicator(true);
        elevator.goingDownIndicator(true);

        // search for a new destination, defaulting to the middle floor
        elevatorObj.updateDesitnationFloor();

        elevatorObj.logStatus('idle');
      });

      return elevatorObj;
    }

    // Create an array of elevator objects (one for each elevator)
    var elevatorObjs = _.map(elevators, createElevatorObj, this);

    function wakeAnIdleElevator() {
      for (var i = 0; i < elevatorObjs.length; i++) {
        var elevatorObj = elevatorObjs[i];
        if (!_.isFinite(elevatorObj.destinationFloor)) {
          elevatorObj.updateDesitnationFloor();
          break;
        }
      }
    }
  },

  update: function(dt, elevators, floors) {    
    // We normally don't need to do anything here
  }
}
