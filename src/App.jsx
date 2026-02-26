import BabylonCanvas from "./components/BabylonCanvas";

export default function App() {
  return (
    <div className="w-screen h-screen bg-black relative">
      <BabylonCanvas />
      <div className="absolute top-4 left-4 text-white">
        <h1 className="text-2xl font-bold">Shuify</h1>
      </div>
    </div>
  );
}