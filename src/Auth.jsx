import { useState } from 'react'
import { supabase } from './lib/supabaseClient'

function Auth() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function signUp() {
    if (!email || !password) return

    setLoading(true)

    const { error } = await supabase.auth.signUp({
      email,
      password,
    })

    setLoading(false)

    if (error) {
      alert(error.message)
      return
    }

    alert('您已成功注册本站账号，请去邮箱确认一下吧！')
  }

  async function signIn() {
    if (!email || !password) return

    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    setLoading(false)

    if (error) {
      alert(error.message)
      return
    }

    alert('登陆成功！')
  }

  return (
    <div
      style={{
        maxWidth: 400,
        margin: '80px auto',
        padding: 24,
      }}
    >
      <h1>cheeseburg chat</h1>
      <h2>登录 / 注册</h2>

      <input
        type="email"
        placeholder="邮箱"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{
          display: 'block',
          width: '100%',
          marginBottom: 12,
          padding: 10,
        }}
      />

      <input
        type="password"
        placeholder="密码"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{
          display: 'block',
          width: '100%',
          marginBottom: 12,
          padding: 10,
        }}
      />

      <button
        onClick={signIn}
        disabled={loading}
        style={{ marginRight: 10 }}
      >
        登录
      </button>

      <button
        onClick={signUp}
        disabled={loading}
      >
        注册
      </button>
    </div>
  )
}

export default Auth