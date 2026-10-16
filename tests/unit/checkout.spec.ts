import { describe, expect, it } from 'vitest'
import {
  CHECKOUT_MAX_LENGTH,
  EMAIL_MAX_LENGTH,
  firstInvalidField,
  normalizeCheckoutForm,
  orderErrorMessage,
  parseOrderNumber,
  prefillCheckout,
  toCartAddBody,
  validateCheckout,
} from '../../utils/checkout'
import type { CheckoutForm } from '../../types/checkout'
import type { CartItem } from '../../types/cart'

function form(overrides: Partial<CheckoutForm> = {}): CheckoutForm {
  return {
    fullName: 'Jean Dupont',
    email: 'jean.dupont@exemple.fr',
    address: '1 rue de Troyes',
    postalCode: '10000',
    city: 'Troyes',
    ...overrides,
  }
}

function item(overrides: Partial<CartItem> = {}): CartItem {
  return {
    productId: 1,
    quantity: 1,
    unitPriceCents: 999,
    category: 'beauty',
    stock: 5,
    ...overrides,
  }
}

describe('normalizeCheckoutForm', () => {
  it('retire les espaces autour et réduit les espaces multiples', () => {
    expect(
      normalizeCheckoutForm(
        form({
          fullName: '  Jean   Dupont  ',
          email: '  jean.dupont@exemple.fr  ',
          address: '1  rue\t de Troyes',
          city: ' Sainte   Savine ',
        }),
      ),
    ).toEqual({
      fullName: 'Jean Dupont',
      email: 'jean.dupont@exemple.fr',
      address: '1 rue de Troyes',
      postalCode: '10000',
      city: 'Sainte Savine',
    })
  })

  it('code postal : tous les espaces supprimés (« 10 000 » → « 10000 »)', () => {
    expect(normalizeCheckoutForm(form({ postalCode: '10 000' })).postalCode).toBe('10000')
    expect(normalizeCheckoutForm(form({ postalCode: ' 75 001 ' })).postalCode).toBe('75001')
  })

  it('champs déjà propres : inchangés', () => {
    expect(normalizeCheckoutForm(form())).toEqual(form())
  })
})

describe('validateCheckout', () => {
  it('formulaire valide : aucune erreur', () => {
    expect(validateCheckout(form())).toEqual({})
  })

  it('fullName vide : message exact', () => {
    expect(validateCheckout(form({ fullName: '' }))).toEqual({
      fullName: 'Saisissez votre nom et prénom.',
    })
  })

  it('email vide : message exact', () => {
    expect(validateCheckout(form({ email: '' }))).toEqual({
      email: 'Saisissez votre adresse e-mail.',
    })
  })

  it('address vide : message exact', () => {
    expect(validateCheckout(form({ address: '' }))).toEqual({
      address: 'Saisissez votre adresse.',
    })
  })

  it('postalCode vide : message exact', () => {
    expect(validateCheckout(form({ postalCode: '' }))).toEqual({
      postalCode: 'Saisissez votre code postal.',
    })
  })

  it('city vide : message exact', () => {
    expect(validateCheckout(form({ city: '' }))).toEqual({
      city: 'Saisissez votre ville.',
    })
  })

  it('champ composé uniquement d’espaces : traité comme vide', () => {
    expect(validateCheckout(form({ city: '   ' }))).toEqual({
      city: 'Saisissez votre ville.',
    })
  })

  it('email sans @ ni domaine : message exact', () => {
    expect(validateCheckout(form({ email: 'jean.dupont' }))).toEqual({
      email: 'Saisissez une adresse e-mail valide, par exemple nom@exemple.fr.',
    })
  })

  it.each(['1234', '123456', 'ABCDE', '123a5'])(
    'code postal « %s » : 5 chiffres exigés',
    (postalCode) => {
      expect(validateCheckout(form({ postalCode }))).toEqual({
        postalCode: 'Le code postal doit comporter 5 chiffres, par exemple 10000.',
      })
    },
  )

  it('code postal avec espaces : validé après normalisation', () => {
    expect(validateCheckout(form({ postalCode: '12 345' }))).toEqual({})
  })

  it('fullName à la limite exacte (100) : valide', () => {
    expect(validateCheckout(form({ fullName: 'a'.repeat(CHECKOUT_MAX_LENGTH) }))).toEqual({})
  })

  it('fullName à 101 : message de longueur', () => {
    expect(validateCheckout(form({ fullName: 'a'.repeat(CHECKOUT_MAX_LENGTH + 1) }))).toEqual({
      fullName: 'Ce champ ne doit pas dépasser 100 caractères.',
    })
  })

  it('address à 101 : message de longueur', () => {
    expect(validateCheckout(form({ address: 'a'.repeat(CHECKOUT_MAX_LENGTH + 1) }))).toEqual({
      address: 'Ce champ ne doit pas dépasser 100 caractères.',
    })
  })

  it('city à 101 : message de longueur', () => {
    expect(validateCheckout(form({ city: 'a'.repeat(CHECKOUT_MAX_LENGTH + 1) }))).toEqual({
      city: 'Ce champ ne doit pas dépasser 100 caractères.',
    })
  })

  it('email valide à la limite exacte (254) : valide', () => {
    const email = `a@${'b'.repeat(249)}.fr`
    expect(email).toHaveLength(EMAIL_MAX_LENGTH)
    expect(validateCheckout(form({ email }))).toEqual({})
  })

  it('email à 255 : message de longueur, avant le test de format', () => {
    const email = `a@${'b'.repeat(250)}.fr`
    expect(email).toHaveLength(EMAIL_MAX_LENGTH + 1)
    expect(validateCheckout(form({ email }))).toEqual({
      email: 'Ce champ ne doit pas dépasser 254 caractères.',
    })
  })

  it('email de 254 caractères sans @ : message de format (longueur OK)', () => {
    expect(validateCheckout(form({ email: 'x'.repeat(EMAIL_MAX_LENGTH) }))).toEqual({
      email: 'Saisissez une adresse e-mail valide, par exemple nom@exemple.fr.',
    })
  })

  it('seuls les champs en erreur sont présents', () => {
    expect(validateCheckout(form({ address: '', city: '' }))).toEqual({
      address: 'Saisissez votre adresse.',
      city: 'Saisissez votre ville.',
    })
  })
})

describe('firstInvalidField', () => {
  it('aucune erreur : null', () => {
    expect(firstInvalidField({})).toBeNull()
  })

  it('tous les champs en erreur : le premier de CHECKOUT_FIELDS', () => {
    const errors = validateCheckout(form({ fullName: '', email: '', postalCode: '' }))
    expect(firstInvalidField(errors)).toBe('fullName')
  })

  it('respecte l’ordre d’affichage, pas l’ordre des clés', () => {
    expect(firstInvalidField({ city: 'x', email: 'x' })).toBe('email')
    expect(firstInvalidField({ address: 'x', city: 'x' })).toBe('address')
  })

  it('un seul champ en erreur : ce champ-là', () => {
    const errors = validateCheckout(form({ postalCode: 'abc', city: '' }))
    expect(firstInvalidField(errors)).toBe('postalCode')
  })
})

describe('prefillCheckout', () => {
  it('utilisateur absent : formulaire vide', () => {
    expect(prefillCheckout(null)).toEqual({
      fullName: '',
      email: '',
      address: '',
      postalCode: '',
      city: '',
    })
  })

  it('préremplit nom et e-mail, laisse l’adresse vide', () => {
    expect(
      prefillCheckout({ firstName: 'Jean', lastName: 'Dupont', email: 'jean@exemple.fr' }),
    ).toEqual({
      fullName: 'Jean Dupont',
      email: 'jean@exemple.fr',
      address: '',
      postalCode: '',
      city: '',
    })
  })

  it('prénom vide : pas d’espace en trop', () => {
    expect(prefillCheckout({ firstName: '', lastName: 'Dupont', email: 'x@exemple.fr' })).toEqual({
      fullName: 'Dupont',
      email: 'x@exemple.fr',
      address: '',
      postalCode: '',
      city: '',
    })
  })

  it('nom de famille vide : pas d’espace en trop', () => {
    expect(
      prefillCheckout({ firstName: 'Jean', lastName: '', email: 'x@exemple.fr' }).fullName,
    ).toBe('Jean')
  })
})

describe('toCartAddBody', () => {
  it('panier vide : aucun produit', () => {
    expect(toCartAddBody(42, [])).toEqual({ userId: 42, products: [] })
  })

  it('2 lignes : productId devient id', () => {
    expect(toCartAddBody(7, [item({ productId: 3, quantity: 2 }), item({ productId: 9 })])).toEqual(
      {
        userId: 7,
        products: [
          { id: 3, quantity: 2 },
          { id: 9, quantity: 1 },
        ],
      },
    )
  })
})

describe('parseOrderNumber', () => {
  it.each([
    ['1', 1],
    ['42', 42],
    ['9999999999', 9999999999],
  ])('numéro « %s » → %i', (value, expected) => {
    expect(parseOrderNumber(value)).toBe(expected)
  })

  it('paramètre répété : garde la première valeur (?numero=1&numero=2)', () => {
    expect(parseOrderNumber(['42', '7'])).toBe(42)
    expect(parseOrderNumber(['42'])).toBe(42)
  })

  // Aucun de ces cas ne doit lever d'erreur : toujours null.
  it.each([
    ['« 0 »', '0'],
    ['« -1 »', '-1'],
    ['« 1.5 »', '1.5'],
    ['« abc »', 'abc'],
    ['« 01 »', '01'],
    ['chaîne vide', ''],
    ['« 42 » avec espaces', ' 42 '],
    ['16 chiffres', '9007199254740993'],
    ['undefined', undefined],
    ['null', null],
    ['booléen', true],
    ['nombre', 42],
    ['nombre décimal', 1.5],
    ['objet', { numero: '1' }],
    ['tableau vide', []],
    ['premier élément invalide', ['0']],
    ['premier élément non chaîne', [42]],
  ])('%s : null, sans erreur', (_label, value) => {
    expect(parseOrderNumber(value)).toBeNull()
  })
})

describe('orderErrorMessage', () => {
  it.each([400, 500, 503])(
    'erreur HTTP %i : paiement indisponible, panier conservé',
    (statusCode) => {
      expect(orderErrorMessage({ statusCode })).toBe(
        'Le paiement est indisponible pour le moment. Votre panier est conservé, réessayez dans quelques instants.',
      )
    },
  )

  it('sans statut (réseau coupé) : vérifier la connexion', () => {
    expect(orderErrorMessage(new TypeError('fetch failed'))).toBe(
      'Impossible de joindre le serveur. Vérifiez votre connexion : votre panier est conservé.',
    )
  })
})
