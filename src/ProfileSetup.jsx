import { useState } from 'react'
import { supabase } from './lib/supabaseClient'

function ProfileSetup({ user, onComplete }) {
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)

  async function createProfile() {
    const cleanUsername = username.trim()

    if (!cleanUsername) {
      alert('想叫啥')
      return
    }

    if (cleanUsername.length < 3) {
      alert('只能注册 3 字符及以上极品id')
      return
    }

    setLoading(true)

    const { error } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        username: cleanUsername,
      })

    setLoading(false)

    if (error) {
      if (error.code === '23505') {
        alert('这个用户名已经有人用了')
      } else {
        alert(error.message)
      }

      console.error(error)
      return
    }

    onComplete()
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
      <h2>设置你滴个人资料</h2>

      <p>
        你的账号：
        <strong>{user.email}</strong>
      </p>

      <input
        type="text"
        placeholder="你想叫啥"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        maxLength={30}
        style={{
          display: 'block',
          width: '100%',
          marginBottom: 12,
          padding: 10,
        }}
      />

      <button
        onClick={createProfile}
        disabled={loading}
      >
        {loading ? '创建中...' : '创建个人资料'}
      </button>
    </div>
  )
}

export default ProfileSetup