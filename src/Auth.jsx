import { useState } from 'react'
import { supabase } from './supabase'

function Auth() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLogin, setIsLogin] = useState(true)
  const [message, setMessage] = useState('')

  async function handleSubmit() {
    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setMessage(error.message)
    } else {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setMessage(error.message)
      else setMessage('Check your email to confirm your account!')
    }
  }

  return (
    <div>
      <h2>{isLogin ? 'Log in' : 'Sign up'}</h2>
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={e => setEmail(e.target.value)}
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={e => setPassword(e.target.value)}
      />
      <button onClick={handleSubmit}>
        {isLogin ? 'Log in' : 'Sign up'}
      </button>
      <p onClick={() => setIsLogin(!isLogin)} style={{ cursor: 'pointer' }}>
        {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Log in'}
      </p>
      {message && <p>{message}</p>}
    </div>
  )
}

export default Auth