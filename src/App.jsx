import { useEffect, useState } from 'react'
import { supabase } from './supabase'

function App() {
  const [status, setStatus] = useState('Connecting...')

  useEffect(() => {
    async function testConnection() {
      const { data, error } = await supabase.auth.getSession()
      if (error) {
        setStatus('❌ Error: ' + error.message)
      } else {
        setStatus('✅ Supabase connected')
      }
    }
    testConnection()
  }, [])

  return (
    <div>
      <h1>Spindown</h1>
      <p>{status}</p>
    </div>
  )
}

export default App