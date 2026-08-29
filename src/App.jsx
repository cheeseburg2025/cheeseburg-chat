import { useEffect, useState } from 'react'
import { supabase } from './lib/supabaseClient'
import Auth from './Auth'
import ProfileSetup from './ProfileSetup'

function App() {
  const [messages, setMessages] = useState([])
  const [content, setContent] = useState('')
  const [session, setSession] = useState(null)

  const [profile, setProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [friendRequests, setFriendRequests] = useState([])
  const [friendUsername, setFriendUsername] = useState('')
  const [profilesById, setProfilesById] = useState({})
  const [selectedFriendId, setSelectedFriendId] = useState(null)
  const [directMessages, setDirectMessages] = useState([])
  const [directContent, setDirectContent] = useState('')
  const [groupName, setGroupName] = useState('')
  const [groups, setGroups] = useState([])
  const [selectedGroupId, setSelectedGroupId] = useState(null)
  const [groupMessages, setGroupMessages] = useState([])
  const [groupContent, setGroupContent] = useState('')

  // 监听登录状态
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)

      if (!newSession) {
        setProfile(null)
        setMessages([])
        setFriendRequests([])
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  // 登录后检查 profile
  useEffect(() => {
    if (!session) {
      setProfileLoading(false)
      return
    }
    loadFriendRequests()
    loadProfile()
  }, [session])

  // 有 profile 后才进入聊天室并监听消息
  useEffect(() => {
    if (!session || !profile) return

    loadMessages()
    loadGroups()

    const channel = supabase
      .channel('messages-channel')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          setMessages((currentMessages) => [
            ...currentMessages,
            payload.new,
          ])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [session, profile])

  useEffect(() => {
  if (!selectedFriendId) {
    setDirectMessages([])
    return
  }

  loadDirectMessages(selectedFriendId)
}, [selectedFriendId])

  useEffect(() => {
  if (!session || !selectedFriendId) return

  const channel = supabase
    .channel(`direct-messages-${selectedFriendId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'direct_messages',
      },
      (payload) => {
        const message = payload.new

        const belongsToCurrentChat =
          (message.sender_id === session.user.id &&
            message.receiver_id === selectedFriendId) ||
          (message.sender_id === selectedFriendId &&
            message.receiver_id === session.user.id)

        if (belongsToCurrentChat) {
          loadDirectMessages(selectedFriendId)
        }
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}, [session, selectedFriendId])

  useEffect(() => {
  if (!selectedGroupId) {
    setGroupMessages([])
    return
  }

  loadGroupMessages(selectedGroupId)
}, [selectedGroupId])


  async function loadProfile() {
    setProfileLoading(true)

    const { data, error } = await supabase
      .from('profiles')
      .select('id, username')
      .eq('id', session.user.id)
      .maybeSingle()

    if (error) {
      console.error(error)
      alert(error.message)
      setProfileLoading(false)
      return
    }

    setProfile(data)
    setProfileLoading(false)
  }

  async function loadMessages() {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: true })

    if (error) {
      console.error(error)
      return
    }

    setMessages(data ?? [])
  }
  async function loadFriendRequests() {
    const { data, error } = await supabase
      .from('friend_requests')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error(error)
      return
    }

    const requests = data ?? []

    setFriendRequests(requests)
    await loadProfilesForRequests(requests)
  }

  async function loadGroups() {
  const { data, error } = await supabase
    .from('chat_groups')
    .select('id, name, owner_id, created_at')
    .order('created_at', { ascending: false })

  if (error) {
    console.error(error)
    return
  }

  setGroups(data ?? [])
}


  async function loadGroupMessages(groupId) {
  const { data, error } = await supabase
    .from('group_messages')
    .select('*')
    .eq('group_id', groupId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error(error)
    return
  }

  setGroupMessages(data ?? [])
}


  async function sendGroupMessage() {
  if (!groupContent.trim() || !selectedGroupId) return

  const { error } = await supabase
    .from('group_messages')
    .insert({
      group_id: selectedGroupId,
      sender_id: session.user.id,
      content: groupContent.trim(),
    })

  if (error) {
    console.error(error)
    alert(error.message)
    return
  }

  setGroupContent('')
  await loadGroupMessages(selectedGroupId)
}

  async function loadDirectMessages(friendId) {
  const { data, error } = await supabase
    .from('direct_messages')
    .select('*')
    .or(
      `and(sender_id.eq.${session.user.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${session.user.id})`
    )
    .order('created_at', { ascending: true })

  if (error) {
    console.error(error)
    return
  }

  setDirectMessages(data ?? [])
}

async function sendDirectMessage() {
  if (!directContent.trim() || !selectedFriendId) return

  const { error } = await supabase
    .from('direct_messages')
    .insert({
      sender_id: session.user.id,
      receiver_id: selectedFriendId,
      content: directContent.trim(),
    })

  if (error) {
    console.error(error)
    alert(error.message)
    return
  }

  setDirectContent('')
  await loadDirectMessages(selectedFriendId)
}

  async function createGroup() {
  const name = groupName.trim()

  if (!name) return

  const { data: group, error: groupError } = await supabase
    .from('chat_groups')
    .insert({
      name,
      owner_id: session.user.id,
    })
    .select('id, name, owner_id')
    .single()

  if (groupError) {
    console.error(groupError)
    alert(groupError.message)
    return
  }

  const { error: memberError } = await supabase
    .from('group_members')
    .insert({
      group_id: group.id,
      user_id: session.user.id,
      role: 'owner',
    })

  if (memberError) {
    console.error(memberError)
    alert(memberError.message)
    return
  }

  setGroupName('')
  await loadGroups()
  alert('群聊创建成功')
}


  async function loadProfilesForRequests(requests) {
  const userIds = [
    ...new Set(
      requests.flatMap((request) => [
        request.sender_id,
        request.receiver_id,
      ])
    ),
  ]

  if (userIds.length === 0) {
    setProfilesById({})
    return
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, username')
    .in('id', userIds)

  if (error) {
    console.error(error)
    return
  }

  const map = {}

  for (const user of data ?? []) {
    map[user.id] = user.username
  }

  setProfilesById(map)
}

  async function sendFriendRequest() {
  const username = friendUsername.trim()

  if (!username) return

  // 先通过用户名找到对方
  const { data: targetProfile, error: profileError } = await supabase
    .from('profiles')
    .select('id, username')
    .eq('username', username)
    .maybeSingle()

  if (profileError) {
    console.error(profileError)
    alert(profileError.message)
    return
  }

  if (!targetProfile) {
    alert('查无此人')
    return
  }

  if (targetProfile.id === session.user.id) {
    alert('孤独到只能添加自己为好友了吗')
    return
  }

  const { data: existingRequest, error: existingError } = await supabase
  .from('friend_requests')
  .select('id, status')
  .or(
    `and(sender_id.eq.${session.user.id},receiver_id.eq.${targetProfile.id}),and(sender_id.eq.${targetProfile.id},receiver_id.eq.${session.user.id})`
  )
  .in('status', ['pending', 'accepted'])
  .limit(1)
  .maybeSingle()

if (existingError) {
  console.error(existingError)
  alert(existingError.message)
  return
}

if (existingRequest) {
  if (existingRequest.status === 'accepted') {
    alert('想干嘛 你们已经是好友了')
  } else {
    alert('你还有人没通过呢')
  }

  return
}

  // 创建好友请求
  const { error } = await supabase
    .from('friend_requests')
    .insert({
      sender_id: session.user.id,
      receiver_id: targetProfile.id,
      status: 'pending',
    })

  if (error) {
    console.error(error)
    alert(error.message)
    return
  }

  setFriendUsername('')
  loadFriendRequests()

  alert('先等一会看看对方想不想加你')
}

async function acceptFriendRequest(requestId) {
  const { error } = await supabase
    .from('friend_requests')
    .update({ status: 'accepted' })
    .eq('id', requestId)
    .eq('receiver_id', session.user.id)
    .eq('status', 'pending')

  if (error) {
    console.error(error)
    alert(error.message)
    return
  }

  await loadFriendRequests()
}

  async function rejectFriendRequest(requestId) {
  const { error } = await supabase
    .from('friend_requests')
    .update({ status: 'rejected' })
    .eq('id', requestId)
    .eq('receiver_id', session.user.id)
    .eq('status', 'pending')

  if (error) {
    console.error(error)
    alert(error.message)
    return
  }

  await loadFriendRequests()
}

  async function sendMessage() {
    if (!content.trim() || !profile) return

    const { error } = await supabase
      .from('messages')
      .insert({
        user_id: session.user.id,
        username: profile.username,
        content: content.trim(),
      })

    if (error) {
      alert(JSON.stringify(error, null, 2))
      console.error(error)
      return
    }

    setContent('')
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut()

    if (error) {
      alert(error.message)
    }
  }

  // 没登录
  if (!session) {
    return <Auth />
  }

  // 正在检查 profile
  if (profileLoading) {
    return (
      <div style={{ padding: 40 }}>
        猜猜我在干嘛...
      </div>
    )
  }

  // 已登录，但还没 profile
  if (!profile) {
    return (
      <ProfileSetup
        user={session.user}
        onComplete={loadProfile}
      />
    )
  }

  // 正式聊天室
  return (
    <div
      style={{
        maxWidth: 700,
        margin: '40px auto',
        padding: 20,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <h1>芝堡聊天室</h1>

        <button onClick={signOut}>
          退出登录
        </button>
      </div>

      <div style={{ marginBottom: 20 }}>
        我是谁：
        <strong>{profile.username}</strong>
      </div>

        <div style={{ marginBottom: 20 }}>
  <div>想加你好友的：</div>

  {friendRequests
    .filter(
      (request) =>
        request.receiver_id === session.user.id &&
        request.status === 'pending'
    )
    .map((request) => (
      <div
        key={request.id}
        style={{ marginTop: 8 }}
      >
        <strong>
        {profilesById[request.sender_id] ?? '特异人士'}
        </strong>
        <span> 想跟你加好友</span>

        <button
          onClick={() => acceptFriendRequest(request.id)}
          style={{ marginLeft: 10 }}
        >
          同意
        </button>
        <button
          onClick={() => rejectFriendRequest(request.id)}
          style={{ marginLeft: 8 }}
        >
          拒绝
        </button>
      </div>
    ))}
    
    <div style={{ marginBottom: 20 }}>
  <div>好友：</div>

  {friendRequests
    .filter((request) => request.status === 'accepted')
    .map((request) => {
      const friendId =
        request.sender_id === session.user.id
          ? request.receiver_id
          : request.sender_id

      return (
        <button
          key={request.id}
          onClick={() => setSelectedFriendId(friendId)}
          style={{
            display: 'block',
            marginTop: 8,
          }}
        >
          {profilesById[friendId] ?? '特异人士'}
        </button>
      )
    })}
</div>


     <div style={{ marginBottom: 20 }}>
  <div>创建群聊：</div>

  <input
    placeholder="输入群名..."
    value={groupName}
    onChange={(e) => setGroupName(e.target.value)}
  />

  <button
    onClick={createGroup}
    style={{ marginLeft: 8 }}
  >
    创建群聊
  </button>
</div>

    <div style={{ marginBottom: 20 }}>
  <div>我的群聊：</div>

  {groups.map((group) => (
  <button
    key={group.id}
    onClick={() => setSelectedGroupId(group.id)}
    style={{
      display: 'block',
      marginTop: 8,
    }}
  >
    {group.name}
  </button>
))}
</div>

      {selectedGroupId && (
  <div style={{ marginTop: 20 }}>
    当前群聊：
    <strong>
      {' '}
      {groups.find((group) => group.id === selectedGroupId)?.name ?? '未知群聊'}
    </strong>
  </div>
)}

      {selectedGroupId && (
  <div
    style={{
      border: '1px solid #ccc',
      minHeight: 150,
      marginTop: 10,
      padding: 10,
    }}
  >
    {groupMessages.map((message) => (
      <div
        key={message.id}
        style={{ marginBottom: 8 }}
      >
        <strong>
          {message.sender_id === session.user.id
            ? '我'
            : profilesById[message.sender_id] ?? '群成员'}
        </strong>

        <div>{message.content}</div>
      </div>
    ))}
  </div>
)}

      {selectedFriendId && (
        <div style={{ marginTop: 20 }}>
          正在和
          <strong>
            {' '}{profilesById[selectedFriendId] ?? '特异人士'}
          </strong>
          {' '}私聊
        </div>
      )}
      {selectedFriendId && (
  <div
    style={{
      border: '1px solid #ccc',
      minHeight: 150,
      marginTop: 10,
      padding: 10,
    }}
  >
    {directMessages.map((message) => (
      <div
        key={message.id}
        style={{ marginBottom: 8 }}
      >
        <strong>
          {message.sender_id === session.user.id
            ? '我'
            : profilesById[message.sender_id] ?? '好友'}
        </strong>

        <div>{message.content}</div>
      </div>
    ))}
  </div>
)}

  {selectedFriendId && (
  <div style={{ marginTop: 10 }}>
    <input
      placeholder="输入私聊消息..."
      value={directContent}
      onChange={(e) => setDirectContent(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          sendDirectMessage()
        }
      }}
      style={{ width: '70%' }}
    />

    <button onClick={sendDirectMessage}>
      发送私聊
    </button>
  </div>
)}

</div>

      <div style={{ marginBottom: 20 }}>
        <input
        placeholder="想加谁..."
        value={friendUsername}
        onChange={(e) => setFriendUsername(e.target.value)}
      />

  <button onClick={sendFriendRequest}>
    加好友
  </button>
</div>
      <div
        style={{
          border: '1px solid #ccc',
          minHeight: 300,
          marginTop: 20,
          padding: 15,
        }}
      >
        {messages.map((message) => (
          <div
            key={message.id}
            style={{ marginBottom: 12 }}
          >
            <strong>{message.username}</strong>
            <div>{message.content}</div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 20 }}>
        <input
          placeholder="想说啥..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              sendMessage()
            }
          }}
          style={{ width: '70%' }}
        />

        <button onClick={sendMessage}>
          走你
        </button>
      </div>
    </div>
    
  )
}

export default App