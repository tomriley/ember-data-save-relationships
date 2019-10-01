import { run } from '@ember/runloop';
import EmberObject from '@ember/object';
import Ember from 'ember';
import QUnit from 'qunit';
import { module, test } from 'qunit';
import DS from 'ember-data';
import SaveRelationshipsMixin from 'ember-data-save-relationships';

var registry, store, Artist, Album, Track, ContactPerson, SimpleModel, SimpleModelContainer;

QUnit.dump.maxDepth = 15;

module('serializers/save-relationships-mixin', {
  
  beforeEach() {
    
    registry = new Ember.Registry();

    const Owner = EmberObject.extend(Ember._RegistryProxyMixin, Ember._ContainerProxyMixin);
    const owner = Owner.create({
      __registry__: registry
    });
    const container = registry.container({
      owner: owner
    });
    owner.__container__ = container;
    
    SimpleModel = DS.Model.extend({
    });
    
    SimpleModelContainer = DS.Model.extend({
      model: DS.belongsTo('simple-model'),
    });
    
    ContactPerson = DS.Model.extend({
      name: DS.attr()
    });
    
    Artist = DS.Model.extend({
      name: DS.attr(),
      contactPerson: DS.belongsTo(),
      albums: DS.hasMany('album')
    });
    
    Album = DS.Model.extend({
      name: DS.attr(),
      artist: DS.belongsTo('artist'),
      tracks: DS.hasMany('track')
    });

    Track = DS.Model.extend({
      name: DS.attr(),
      album: DS.belongsTo('album')
    });

    const ConfigEnv = EmberObject.extend();
    ConfigEnv['ember-data-save-relationships'] = {
        internalModelKey: '--id--'
    };

    registry.register('config:environment', ConfigEnv);
    registry.register('model:contact-person', ContactPerson);
    registry.register('model:artist', Artist);
    registry.register('model:album', Album);
    registry.register('model:track', Track);
    registry.register('model:simple-model', SimpleModel);
    registry.register('model:simple-model-container', SimpleModelContainer);
    
    registry.register('service:store', DS.Store.extend({ adapter: '-default' }));
        
    store = container.lookup('service:store');
    
    registry.register('adapter:application', DS.JSONAPIAdapter);
    registry.register('serializer:application', DS.JSONAPISerializer);
    
  },
  
  afterEach() {
    run(store, 'destroy');
  }

});

test("serialize artist with embedded albums (with ID set/configured to non-default key)", function(assert) {

  registry.register('serializer:artist', DS.JSONAPISerializer.extend(SaveRelationshipsMixin, {
    attrs: {
      albums: { serialize: true },
      contactPerson: { serialize: false }
    }
  }));

  registry.register('serializer:album', DS.JSONAPISerializer.extend(SaveRelationshipsMixin, {
    attrs: {
      artist: { serialize: false }
    }
  }));

  registry.register('serializer:track', DS.JSONAPISerializer.extend(SaveRelationshipsMixin, {
    attrs: {
      album: { serialize: false }
    }
  }));

  const serializer = store.serializerFor("artist");
  let artistJSON;
  
  run(function() {
    
    const artist = store.createRecord('artist', { name: "Radiohead" });
    const album1 = store.createRecord('album', { name: "Kid A" });
    const album2 = store.createRecord('album', { name: "Kid B" });
    const album3 = store.createRecord('album', { name: "Kid C" });

    serializer.serialize(artist._createSnapshot());

    artist.get('albums').pushObjects([album1, album2, album3]);
  
    assert.equal(artist.get('albums.length'), 3);
    
    artistJSON = serializer.serialize(artist._createSnapshot());

    const albumsJSON = { data: [
      { attributes: { name: 'Kid A', '--id--': getInternalId(album1) },
        type: 'albums' },
      { attributes: { name: 'Kid B', '--id--': getInternalId(album2) },
        type: 'albums' },
      { attributes: { name: 'Kid C', '--id--': getInternalId(album3) },
      type: 'albums' } ]
    };

    assert.deepEqual(artistJSON, { data: {
        attributes: { name: 'Radiohead' },
        relationships: { albums: albumsJSON },
        type: 'artists'
      }
    });

  });
});

function getInternalId(model) {
  return model.get('_internalModel')[Ember.GUID_KEY];
}
