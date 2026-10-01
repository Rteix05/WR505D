import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { debounce } from '../../utils/debounce'

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('n’appelle qu’une fois, 300 ms après la dernière frappe, avec la dernière valeur', () => {
    const search = vi.fn()
    const debounced = debounce(search, 300)

    // « phone » tapé à 100 ms d'intervalle : chaque frappe repousse l'échéance.
    for (const value of ['p', 'ph', 'pho', 'phon', 'phone']) {
      debounced(value)
      vi.advanceTimersByTime(100)
    }
    expect(search).not.toHaveBeenCalled()

    vi.advanceTimersByTime(199)
    expect(search).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(search).toHaveBeenCalledOnce()
    expect(search).toHaveBeenCalledWith('phone')
  })

  it('deux frappes séparées de plus de 300 ms donnent deux appels', () => {
    const search = vi.fn()
    const debounced = debounce(search, 300)

    debounced('pho')
    vi.advanceTimersByTime(300)
    debounced('phone')
    vi.advanceTimersByTime(300)
    expect(search.mock.calls).toEqual([['pho'], ['phone']])
  })

  it('pending indique un appel en attente', () => {
    const debounced = debounce(vi.fn(), 300)
    expect(debounced.pending()).toBe(false)
    debounced('a')
    expect(debounced.pending()).toBe(true)
    vi.advanceTimersByTime(300)
    expect(debounced.pending()).toBe(false)
  })

  it('cancel abandonne l’appel en attente', () => {
    const search = vi.fn()
    const debounced = debounce(search, 300)

    debounced('phone')
    debounced.cancel()
    vi.advanceTimersByTime(1000)
    expect(search).not.toHaveBeenCalled()
    expect(debounced.pending()).toBe(false)
  })

  it('flush exécute tout de suite l’appel en attente, une seule fois', () => {
    const search = vi.fn()
    const debounced = debounce(search, 300)

    debounced('phone')
    debounced.flush()
    expect(search).toHaveBeenCalledWith('phone')
    vi.advanceTimersByTime(1000)
    expect(search).toHaveBeenCalledOnce()
  })

  it('flush sans appel en attente ne fait rien', () => {
    const search = vi.fn()
    debounce(search, 300).flush()
    expect(search).not.toHaveBeenCalled()
  })
})
