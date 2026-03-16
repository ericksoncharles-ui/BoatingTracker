import { marinas } from './data'
import { useTripCalculator } from './hooks/useTripCalculator'
import Sidebar from './components/Sidebar'
import TripMap from './components/TripMap'

export default function App() {
  const trip = useTripCalculator()

  return (
    <div className="app">
      <Sidebar
        startId={trip.startId}
        setStartId={trip.setStartId}
        destId={trip.destId}
        setDestId={trip.setDestId}
        tankSize={trip.tankSize}
        setTankSize={trip.setTankSize}
        cruisingSpeed={trip.cruisingSpeed}
        setCruisingSpeed={trip.setCruisingSpeed}
        fuelBurn={trip.fuelBurn}
        setFuelBurn={trip.setFuelBurn}
        tripResult={trip.tripResult}
        onCalculate={trip.calculateTrip}
        onReset={trip.resetTrip}
      />
      <TripMap marinas={marinas} tripResult={trip.tripResult} />
    </div>
  )
}
