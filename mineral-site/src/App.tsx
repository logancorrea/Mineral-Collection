import { useState } from "react";

type Specimen = {
  id: number;
  name: string;
};

const specimens: Specimen[] = [
  { id: 1, name: "Topaz" },
  { id: 2, name: "Quartz" },
  { id: 3, name: "Bixbyite" },
  { id: 4, name: "Hematite" },
];

export default function App() {
  const [selected, setSelected] = useState<Specimen | null>(null);

  return (
    <div className="flex h-screen font-sans">
      {/* Left Sidebar */}
      <aside className="w-64 bg-gray-100 border-r fixed h-full p-4 overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Specimens</h2>
        <ul className="space-y-2">
          {specimens.map((s) => (
            <li
              key={s.id}
              className="cursor-pointer hover:bg-gray-200 p-2 rounded"
              onClick={() => setSelected(s)}
            >
              {s.id}: {s.name}
            </li>
          ))}
        </ul>
      </aside>

      {/* Right Content Panel */}
      <main className="ml-64 p-6 flex-1 overflow-y-auto">
        {selected ? (
          <div>
            <h1 className="text-2xl font-bold">
              Specimen #{selected.id}: {selected.name}
            </h1>
            <p className="text-gray-600 mt-2">More details will go here.</p>
            <div className="mt-4 border border-gray-300 h-48 flex items-center justify-center text-gray-400">
              [Image and Map Coming Soon]
            </div>
          </div>
        ) : (
          <p className="text-gray-500">Select a specimen from the left.</p>
        )}
      </main>
    </div>
  );
}
