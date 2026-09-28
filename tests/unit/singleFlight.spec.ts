import { describe, expect, it, vi } from 'vitest'
import { createSingleFlight } from '../../utils/singleFlight'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('createSingleFlight', () => {
  it('appels simultanés : la tâche ne s’exécute qu’une fois, tous reçoivent le résultat', async () => {
    const pending = deferred<string>()
    const task = vi.fn(() => pending.promise)
    const run = createSingleFlight(task)

    const calls = [run(), run(), run()]
    pending.resolve('ok')

    await expect(Promise.all(calls)).resolves.toEqual(['ok', 'ok', 'ok'])
    expect(task).toHaveBeenCalledTimes(1)
  })

  it('après la fin de la tâche, un nouvel appel la relance', async () => {
    let count = 0
    const run = createSingleFlight(async () => ++count)
    await expect(run()).resolves.toBe(1)
    await expect(run()).resolves.toBe(2)
  })

  it('échec partagé par tous les appels en cours, puis relance possible', async () => {
    const pending = deferred<string>()
    const task = vi.fn(() => pending.promise)
    const run = createSingleFlight(task)

    const calls = [run(), run()]
    pending.reject(new Error('refus'))
    const results = await Promise.allSettled(calls)
    expect(results.map((result) => result.status)).toEqual(['rejected', 'rejected'])
    expect(task).toHaveBeenCalledTimes(1)

    task.mockResolvedValueOnce('ok')
    await expect(run()).resolves.toBe('ok')
    expect(task).toHaveBeenCalledTimes(2)
  })
})
