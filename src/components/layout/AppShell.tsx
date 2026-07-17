import Sidebar from './Sidebar'
import Header from './Header'

type AppShellProps = {
  children: React.ReactNode
}

export default function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
      <Sidebar />

      <div className="flex flex-1 flex-col">
        <Header />

        <main className="flex-1 overflow-auto p-8">{children}</main>
      </div>
    </div>
  )
}