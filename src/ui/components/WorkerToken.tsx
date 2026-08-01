interface WorkerTokenProps {
  dim?: boolean
}

export function WorkerToken({ dim }: WorkerTokenProps) {
  return (
    <span className={['worker-token', dim ? 'worker-token--dim' : ''].filter(Boolean).join(' ')}>
      人
    </span>
  )
}
