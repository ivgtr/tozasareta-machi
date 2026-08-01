import { StoreProvider } from './StoreProvider'
import { PlayScreen } from './screens/PlayScreen'

export function App() {
  return (
    <StoreProvider>
      <PlayScreen />
    </StoreProvider>
  )
}
