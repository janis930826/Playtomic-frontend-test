import { useState } from 'react'
import useSWR from 'swr'
import Avatar from '@mui/material/Avatar'
import AvatarGroup from '@mui/material/AvatarGroup'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TablePagination from '@mui/material/TablePagination'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import { useApiFetcher } from '@/lib/api'
import { Match } from '@/lib/api-types'

export interface MatchesProps {
  onLogoutRequest?: () => void
}

export function Matches(props: MatchesProps) {
  const { onLogoutRequest, ...otherProps } = props
  const [page, setPage] = useState<number>(0)
  const [size, setSize] = useState<number>(10)
  const [downloading, setDownloading] = useState(false)
  const fetcher = useApiFetcher()
  const query = useSWR(
    { page, size },
    async ({ page, size }: { page: number; size: number }): Promise<{ matches: Match[]; total: number }> => {
      const res = await fetcher('GET /v1/matches', { page, size })

      if (!res.ok) {
        throw new Error(res.data.message)
      }

      const totalCount = res.headers.get('total')
      const total = totalCount ? Number.parseInt(totalCount) : res.data.length
      return { matches: res.data, total }
    },
    { keepPreviousData: true, suspense: true },
  )
  const matches: Match[] = query.data.matches
  const total: number = query.data.total

  // --- Download all matches handler ---
  const handleDownloadAll = async () => {
    setDownloading(true)
    try {
      // Get ALL matches (set page=0, size=1000)
      const res = await fetcher('GET /v1/matches', { page: 0, size: 1000 })
      if (!res.ok) throw new Error(res.data.message)

      const allMatches = res.data as Match[]
      const csvRows = [
        ['Match ID', 'Sport', 'Venue', 'Court', 'Start Date', 'End Date', 'Players'].join(','),
        ...allMatches.map(match =>
          [
            match.matchId,
            match.sport,
            match.venueId,
            match.courtId,
            match.startDate,
            match.endDate,
            match.teams.flatMap(t => t.players.map(p => p.displayName)).join(' | '),
          ]
            .map(field => `"${String(field).replace(/"/g, '""')}"`)
            .join(','),
        ),
      ]

      const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'matches.csv'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not download matches. Please try again.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <Stack {...otherProps}>
      <Stack direction="row" marginBottom={2} justifyContent="space-between" alignItems="center">
        <Typography variant="h2">Matches</Typography>
        <Stack direction="row" spacing={2} justifyContent="space-between">
          <Button size="small" variant="outlined" onClick={handleDownloadAll} disabled={downloading}>
            {downloading ? 'Downloading...' : '⬇️ Download all matches'}
          </Button>
          <Button size="small" onClick={onLogoutRequest}>
            Logout
          </Button>
        </Stack>
      </Stack>
      <TableContainer component={Paper}>
        <Table sx={{ minWidth: 650 }} aria-label="Matches">
          <TableHead>
            <TableRow>
              <TableCell>Sport</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Start</TableCell>
              <TableCell>End</TableCell>
              <TableCell>Players</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {matches.map(match => {
              const startDate = match.startDate.substring(0, 10)
              const startTime = match.startDate.substring(11, 16)
              const endTime = match.endDate.substring(11, 16)

              return (
                <TableRow key={match.matchId}>
                  <TableCell>
                    <Chip size="small" label={match.sport} />
                  </TableCell>
                  <TableCell>{startDate}</TableCell>
                  <TableCell>{startTime}</TableCell>
                  <TableCell>{endTime}</TableCell>
                  <TableCell align="left">
                    <AvatarGroup max={4} sx={{ flexDirection: 'row' }}>
                      {match.teams
                        .flatMap(team => team.players)
                        .map(player => (
                          <Avatar
                            key={player.userId}
                            sx={{ width: 28, height: 28 }}
                            alt={player.displayName}
                            src={player.pictureURL ?? undefined}
                          />
                        ))}
                    </AvatarGroup>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        component="div"
        count={total}
        page={page}
        rowsPerPage={size}
        onPageChange={(_, page) => {
          setPage(page)
        }}
        onRowsPerPageChange={ev => {
          setSize(parseInt(ev.target.value, 10))
          setPage(0)
        }}
      />
    </Stack>
  )
}
