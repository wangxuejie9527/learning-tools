export const formatTime = date => {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hour = date.getHours()
  const minute = date.getMinutes()
  const second = date.getSeconds()

  return (
    [year, month, day].map(formatNumber).join('/') +
    ' ' +
    [hour, minute, second].map(formatNumber).join(':')
  )
}

export const formatTimeYYMMDD = date => {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()

  return (
    // [year, month, day].map(formatNumber).join('-')
    '2024-03-15'
  )
}

const formatNumber = n => {
  const s = n.toString()
  return s[1] ? s : '0' + s
}
