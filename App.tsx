import { StatusBar } from "expo-status-bar";
import { GameScreen } from "./app/screens/GameScreen";

export default function App() {
  return (
    <>
      <GameScreen />
      <StatusBar style="light" />
    </>
  );
}
