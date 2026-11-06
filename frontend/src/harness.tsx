import { createRoot } from "react-dom/client";
import { useState } from "react";
import "./index.css";
import { Splash } from "./components/brand/Splash";
import { NuviLogo } from "./components/brand/NuviLogo";
function H() {
  const [ready, setReady] = useState(false);
  const [done, setDone] = useState(false);
  (window as unknown as { go: () => void }).go = () => setReady(true);
  const q = new URLSearchParams(location.search);
  if (q.get("dark")) document.documentElement.classList.add("dark");
  return (<main><div className="p-4">
    <div data-splash-target><NuviLogo size={28} tone="auto" /></div>
    <div className="mt-6 flex flex-col gap-4"><NuviLogo size={72} tone="auto" /><NuviLogo size={40} tone="auto" wave />
    <div className="bg-[#E8590C] p-4"><NuviLogo size={40} tone="onOrange" /></div><NuviLogo size={18} tone="auto" /></div>
    {!done && <Splash ready={ready} onDone={() => setDone(true)} />}</div></main>);
}
createRoot(document.getElementById("root")!).render(<H />);
