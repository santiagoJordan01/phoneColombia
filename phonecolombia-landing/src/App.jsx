import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import Navbar from "./components/navbar.jsx";
import Hero from "./components/Hero.jsx";
import "./styles.css";
function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '1rem 0' }}>
        <Navbar />
      </div>
      <Hero />
     
    </>
  )
}

export default App
