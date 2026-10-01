import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import CatalogSearch from '~/components/CatalogSearch.vue'
import { DEFAULT_FILTERS } from '~/utils/catalogQuery'
import type { CatalogFilters } from '~/types/catalog'

const filters = (changes: Partial<CatalogFilters> = {}): CatalogFilters => ({
  ...DEFAULT_FILTERS,
  ...changes,
})

describe('CatalogSearch', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('le champ a un label relié et reprend la recherche de l’URL', async () => {
    const wrapper = await mountSuspended(CatalogSearch, {
      props: { filters: filters({ q: 'phone' }) },
    })
    expect(wrapper.find('label[for="catalog-search"]').exists()).toBe(true)
    expect(wrapper.find<HTMLInputElement>('#catalog-search').element.value).toBe('phone')
    expect(wrapper.find('form').attributes('role')).toBe('search')
  })

  it('frappe rapide : une seule recherche, 300 ms après la dernière lettre', async () => {
    const wrapper = await mountSuspended(CatalogSearch, { props: { filters: filters() } })
    const input = wrapper.find('#catalog-search')

    for (const value of ['p', 'ph', 'pho', 'phon', 'phone']) {
      await input.setValue(value)
      vi.advanceTimersByTime(100)
    }
    expect(wrapper.emitted('search')).toBeUndefined()

    vi.advanceTimersByTime(200)
    expect(wrapper.emitted('search')).toEqual([['phone']])
  })

  it('Entrée lance la recherche sans attendre, espaces retirés', async () => {
    const wrapper = await mountSuspended(CatalogSearch, { props: { filters: filters() } })
    await wrapper.find('#catalog-search').setValue('  mascara ')
    await wrapper.find('form').trigger('submit')
    expect(wrapper.emitted('search')).toEqual([['mascara']])

    vi.advanceTimersByTime(1000)
    expect(wrapper.emitted('search')).toHaveLength(1)
  })

  it('n’émet rien si la recherche n’a pas changé (ex. espace ajouté)', async () => {
    const wrapper = await mountSuspended(CatalogSearch, {
      props: { filters: filters({ q: 'phone' }) },
    })
    await wrapper.find('#catalog-search').setValue('phone ')
    vi.advanceTimersByTime(300)
    expect(wrapper.emitted('search')).toBeUndefined()
  })

  it('l’URL change sans le champ (bouton retour) : le champ suit', async () => {
    const wrapper = await mountSuspended(CatalogSearch, {
      props: { filters: filters({ q: 'phone' }) },
    })
    await wrapper.setProps({ filters: filters({ q: 'table' }) })
    expect(wrapper.find<HTMLInputElement>('#catalog-search').element.value).toBe('table')
  })

  it('pendant la frappe, une URL plus ancienne n’efface pas ce qui est tapé', async () => {
    const wrapper = await mountSuspended(CatalogSearch, { props: { filters: filters() } })
    const input = wrapper.find<HTMLInputElement>('#catalog-search')

    await input.setValue('pho')
    vi.advanceTimersByTime(300)
    await input.setValue('phon') // tapé avant que l'URL ne passe à « pho »
    await wrapper.setProps({ filters: filters({ q: 'pho' }) })
    expect(input.element.value).toBe('phon')
  })

  it('sans JavaScript : les autres filtres partent en champs cachés, sans la page', async () => {
    const wrapper = await mountSuspended(CatalogSearch, {
      props: {
        filters: filters({ q: 'old', category: 'beauty', sortBy: 'price', order: 'desc', page: 3 }),
      },
    })
    const hidden = wrapper
      .findAll('input[type="hidden"]')
      .map((field) => [field.attributes('name'), field.attributes('value')])
    expect(hidden).toEqual([
      ['category', 'beauty'],
      ['sortBy', 'price'],
      ['order', 'desc'],
    ])
    expect(wrapper.find('form').attributes()).toMatchObject({ method: 'get', action: '/produits' })
  })
})
